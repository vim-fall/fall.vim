/**
 * @module processor/match
 *
 * Matching processor for vim-fall.
 *
 * This module provides the MatchProcessor class which filters items based on
 * user queries using configurable matchers. It supports:
 *
 * - Multiple matcher implementations (fuzzy, substring, regex, etc.)
 * - Incremental matching for performance optimization
 * - Asynchronous processing with chunking
 * - Query caching to avoid redundant processing
 * - Matcher switching during runtime
 *
 * The processor transforms collected items into filtered items that match
 * the current query, emitting events to coordinate with other components.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import { delay } from "jsr:@std/async@^1.0.0/delay";
import { take } from "jsr:@core/iterutil@^0.9.0/async/take";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { Matcher, MatchParams } from "jsr:@vim-fall/core@^0.3.0/matcher";

import { Chunker } from "../lib/chunker.ts";
import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

/** Default delay interval between processing cycles */
const INTERVAL = 0;

/** Default maximum number of items to process */
const THRESHOLD = 100000;

/** Default number of items to process in each chunk */
const CHUNK_SIZE = 1000;

/** Default interval in milliseconds between chunk updates */
const CHUNK_INTERVAL = 100;

/**
 * Configuration options for the MatchProcessor.
 *
 * @template T - The type of detail data associated with each item
 */
export type MatchProcessorOptions<T extends Detail> = {
  /** Initial filtered items (useful for resume) */
  initialItems?: readonly IdItem<T>[];

  /** Initial query string */
  initialQuery?: string;

  /** Initial matcher index */
  initialIndex?: number;

  /** Delay between processing cycles in ms (default: 0) */
  interval?: number;

  /** Maximum items to process (default: 100000) */
  threshold?: number;

  /** Items per chunk (default: 1000) */
  chunkSize?: number;

  /** Max time between chunk updates in ms (default: 100) */
  chunkInterval?: number;

  /** Enable incremental matching mode for better performance */
  incremental?: boolean;
};

/**
 * Processor responsible for filtering items based on user queries.
 *
 * The MatchProcessor applies matchers to filter collected items according to
 * the current query. It supports multiple matchers that can be switched
 * dynamically, and provides both standard and incremental matching modes.
 *
 * @template T - The type of detail data associated with each item
 *
 * @example
 * ```typescript
 * const processor = new MatchProcessor([fzf(), substring()], {
 *   incremental: true,
 *   chunkSize: 500,
 * });
 *
 * // Start matching
 * processor.start(denops, {
 *   items: collectedItems,
 *   query: "search term",
 * });
 *
 * // Switch matcher
 * processor.matcherIndex = 1;
 * ```
 */
export class MatchProcessor<T extends Detail> implements Disposable {
  readonly matchers: ItemBelt<Matcher<T>>;
  readonly #interval: number;
  readonly #threshold: number;
  readonly #chunkSize: number;
  readonly #chunkInterval: number;
  readonly #incremental: boolean;
  #controller: AbortController = new AbortController();
  #processing?: Promise<void>;
  #reserved?: () => void;
  #items: IdItem<T>[];
  #previousQuery?: string;

  constructor(
    matchers: readonly [Matcher<T>, ...Matcher<T>[]],
    options: MatchProcessorOptions<T> = {},
  ) {
    this.matchers = new ItemBelt(matchers, {
      index: options.initialIndex,
    });
    this.#interval = options.interval ?? INTERVAL;
    this.#threshold = options.threshold ?? THRESHOLD;
    this.#chunkSize = options.chunkSize ?? CHUNK_SIZE;
    this.#chunkInterval = options.chunkInterval ?? CHUNK_INTERVAL;
    this.#incremental = options.incremental ?? false;
    this.#items = options.initialItems?.slice() ?? [];
    this.#previousQuery = options.initialQuery;
  }

  get #matcher(): Matcher<T> {
    return this.matchers.current!;
  }

  /**
   * Gets the currently filtered items.
   *
   * @returns Array of items that match the current query
   */
  get items(): IdItem<T>[] {
    return this.#items;
  }

  /**
   * Gets the total number of available matchers.
   */
  get matcherCount(): number {
    return this.matchers.count;
  }

  /**
   * Gets the current matcher index.
   */
  get matcherIndex(): number {
    return this.matchers.index;
  }

  /**
   * Sets the current matcher index.
   *
   * @param index - The matcher index or "$" for the last matcher
   */
  set matcherIndex(index: number | "$") {
    if (index === "$") {
      index = this.matchers.count;
    }
    this.matchers.index = index;
  }

  #validateAvailability(): void {
    try {
      this.#controller.signal.throwIfAborted();
    } catch (err) {
      if (err === null) {
        throw new Error("The processor is already disposed");
      }
      throw err;
    }
  }

  /**
   * Starts the matching process.
   *
   * This method filters the provided items based on the query using the
   * current matcher. It handles:
   * - Query caching to avoid redundant processing
   * - Incremental matching when enabled
   * - Asynchronous processing with progress updates
   *
   * The method emits:
   * - `match-processor-started`: When matching begins
   * - `match-processor-updated`: When new matches are found
   * - `match-processor-succeeded`: When matching completes
   * - `match-processor-failed`: If an error occurs
   *
   * @param denops - The Denops instance
   * @param params - Items to filter and the query string
   * @param options - Optional configuration
   * @param options.restart - Force restart even if processing
   *
   * @example
   * ```typescript
   * processor.start(denops, {
   *   items: collectedItems,
   *   query: "search term",
   * });
   * ```
   */
  start(
    denops: Denops,
    { items, query }: MatchParams<T>,
    options?: { restart?: boolean },
  ): void {
    this.#validateAvailability();
    if (query === this.#previousQuery) {
      if (!this.#processing) {
        dispatch({ type: "match-processor-succeeded" });
      }
      return;
    } else if (this.#processing) {
      // Keep most recent start request for later.
      this.#reserved = () => this.start(denops, { items, query }, options);
      // If restart is requested, we need to abort the current processing.
      if (options?.restart) {
        // This abort will invoke function in `#reserved`.
        this.#controller.abort(null);
        this.#controller = new AbortController();
      }
      return;
    }
    this.#processing = (async () => {
      dispatch({ type: "match-processor-started" });
      this.#previousQuery = query;
      const signal = this.#controller.signal;
      const iter = take(
        this.#matcher.match(denops, { items, query }, { signal }),
        this.#threshold,
      );
      const matchedItems: IdItem<T>[] = [];
      const update = (chunk: Iterable<IdItem<T>>) => {
        matchedItems.push(...chunk);
        // In immediate mode, we need to update items gradually to improve latency.
        if (this.#incremental) {
          this.#items = matchedItems;
          dispatch({ type: "match-processor-updated" });
        }
      };
      const chunker = new Chunker<IdItem<T>>(this.#chunkSize);
      let lastChunkTime = performance.now();
      for await (const item of iter) {
        signal.throwIfAborted();
        if (
          chunker.put(item) ||
          performance.now() - lastChunkTime > this.#chunkInterval
        ) {
          lastChunkTime = performance.now();
          update(chunker.consume());
          await delay(this.#interval, { signal });
        }
      }
      if (chunker.count > 0) {
        update(chunker.consume());
      }
      this.#items = matchedItems;
      dispatch({ type: "match-processor-succeeded" });
    })();
    this.#processing
      .catch((err) => {
        dispatch({ type: "match-processor-failed", err });
      })
      .finally(() => {
        this.#processing = undefined;
      })
      .then(() => {
        this.#reserved?.();
        this.#reserved = undefined;
      });
  }

  /**
   * Disposes of the processor and cancels any ongoing matching.
   *
   * This method is called automatically when the processor is no longer needed.
   * It aborts the matching process and cleans up resources.
   */
  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
