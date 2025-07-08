/**
 * @module processor/collect
 *
 * Collection processor for vim-fall.
 *
 * This module provides the CollectProcessor class which manages the collection
 * of items from a source. It handles:
 *
 * - Asynchronous item collection with progress updates
 * - Chunking for performance optimization
 * - Item deduplication and ID assignment
 * - Pause/resume functionality
 * - Threshold limiting to prevent memory issues
 *
 * The processor emits events during collection to update the UI and coordinate
 * with other components.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import { take } from "jsr:@core/iterutil@^0.9.0/async/take";
import { map } from "jsr:@core/iterutil@^0.9.0/map";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { CollectParams, Source } from "jsr:@vim-fall/core@^0.3.0/source";

import { Chunker } from "../lib/chunker.ts";
import { UniqueOrderedList } from "../lib/unique_ordered_list.ts";
import { dispatch } from "../event.ts";

/** Default maximum number of items to collect */
const THRESHOLD = 100000;

/** Default number of items to process in each chunk */
const CHUNK_SIZE = 1000;

/** Default interval in milliseconds between chunk updates */
const CHUNK_INTERVAL = 100;

/**
 * Configuration options for the CollectProcessor.
 *
 * @template T - The type of detail data associated with each item
 */
export type CollectProcessorOptions<T extends Detail> = {
  /** Initial items to populate the processor with (useful for resume) */
  initialItems?: readonly IdItem<T>[];

  /** Maximum number of items to collect (default: 100000) */
  threshold?: number;

  /** Number of items to process before emitting an update (default: 1000) */
  chunkSize?: number;

  /** Maximum time in ms between updates regardless of chunk size (default: 100) */
  chunkInterval?: number;
};

/**
 * Processor responsible for collecting items from a source.
 *
 * The CollectProcessor manages the asynchronous collection of items from a source,
 * handling chunking, deduplication, and progress updates. It can be paused and
 * resumed, making it suitable for long-running collection operations.
 *
 * @template T - The type of detail data associated with each item
 *
 * @example
 * ```typescript
 * const processor = new CollectProcessor(fileSource, {
 *   threshold: 50000,
 *   chunkSize: 500,
 * });
 *
 * // Start collecting
 * processor.start(denops, { args: ["--hidden"] });
 *
 * // Access collected items
 * console.log(processor.items.length);
 *
 * // Pause if needed
 * processor.pause();
 * ```
 */
export class CollectProcessor<T extends Detail> implements Disposable {
  readonly #controller: AbortController = new AbortController();
  readonly #items: UniqueOrderedList<IdItem<T>>;
  readonly #threshold: number;
  readonly #chunkSize: number;
  readonly #chunkInterval: number;
  #processing?: Promise<void>;
  #paused?: PromiseWithResolvers<void>;

  /**
   * Creates a new CollectProcessor.
   *
   * @param source - The source to collect items from
   * @param options - Configuration options
   */
  constructor(
    readonly source: Source<T>,
    options: CollectProcessorOptions<T> = {},
  ) {
    this.#threshold = options.threshold ?? THRESHOLD;
    this.#chunkSize = options.chunkSize ?? CHUNK_SIZE;
    this.#chunkInterval = options.chunkInterval ?? CHUNK_INTERVAL;
    this.#items = new UniqueOrderedList<IdItem<T>>(
      options.initialItems ?? [],
      {
        // We need to compare "value" rather than "id" for uniqueness,
        // to implement the "resume" functionality correctly.
        identifier: (item) => item.value,
      },
    );
  }

  /**
   * Gets the currently collected items.
   *
   * @returns An array of collected items with assigned IDs
   */
  get items(): readonly IdItem<T>[] {
    return this.#items.items;
  }

  /**
   * Validates that the processor is not disposed.
   *
   * @throws Error if the processor is disposed
   */
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
   * Starts or resumes the collection process.
   *
   * If collection is already in progress and paused, this will resume it.
   * Otherwise, it starts a new collection process.
   *
   * The method emits the following events:
   * - `collect-processor-started`: When collection begins
   * - `collect-processor-updated`: When new items are collected
   * - `collect-processor-succeeded`: When collection completes successfully
   * - `collect-processor-failed`: If an error occurs
   *
   * @param denops - The Denops instance
   * @param params - Parameters to pass to the source's collect method
   *
   * @example
   * ```typescript
   * processor.start(denops, { args: ["--hidden", "--no-ignore"] });
   * ```
   */
  start(
    denops: Denops,
    params: CollectParams,
  ): void | Promise<void> {
    this.#validateAvailability();
    if (this.#processing) {
      this.#resume();
      return;
    }
    this.#processing = (async () => {
      dispatch({ type: "collect-processor-started" });
      const signal = this.#controller.signal;
      const iter = take(
        this.source.collect(denops, params, { signal }),
        this.#threshold,
      );
      const update = (chunk: Iterable<IdItem<T>>) => {
        const offset = this.#items.size;
        this.#items.push(
          ...map(chunk, (item, i) => ({ ...item, id: i + offset })),
        );
        dispatch({ type: "collect-processor-updated" });
      };
      const chunker = new Chunker<IdItem<T>>(this.#chunkSize);
      let lastChunkTime = performance.now();
      for await (const item of iter) {
        if (this.#paused) await this.#paused.promise;
        signal.throwIfAborted();
        if (
          chunker.put(item) ||
          performance.now() - lastChunkTime > this.#chunkInterval
        ) {
          lastChunkTime = performance.now();
          update(chunker.consume());
        }
      }
      if (chunker.count > 0) {
        update(chunker.consume());
      }
      dispatch({ type: "collect-processor-succeeded" });
    })();
    this.#processing
      .catch((err) => {
        dispatch({ type: "collect-processor-failed", err });
      });
  }

  /**
   * Pauses the collection process.
   *
   * The collection can be resumed by calling `start()` again.
   * This is useful for temporarily stopping collection to free up
   * resources or when the user navigates away.
   *
   * @example
   * ```typescript
   * processor.pause();
   * // Later...
   * processor.start(denops, params); // Resumes from where it left off
   * ```
   */
  pause(): void {
    this.#validateAvailability();
    if (!this.#processing) {
      return;
    }
    this.#paused = Promise.withResolvers<void>();
    this.#controller.signal.addEventListener("abort", () => {
      this.#paused?.resolve();
    });
  }

  /**
   * Resumes a paused collection process.
   */
  #resume(): void {
    if (!this.#paused) {
      return;
    }
    this.#paused.resolve();
    this.#paused = undefined;
  }

  /**
   * Disposes of the processor and cancels any ongoing collection.
   *
   * This method is called automatically when the processor is no longer needed.
   * It aborts the collection process and cleans up resources.
   */
  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
