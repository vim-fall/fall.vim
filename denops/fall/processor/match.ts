import type { Denops } from "jsr:@denops/std@^7.3.2";
import { delay } from "jsr:@std/async@^1.0.0/delay";
import { take } from "jsr:@core/iterutil@^0.9.0/async/take";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { Matcher, MatchParams } from "jsr:@vim-fall/core@^0.3.0/matcher";

import { Chunker } from "../lib/chunker.ts";
import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

const INTERVAL = 0;
const THRESHOLD = 100000;
const CHUNK_SIZE = 1000;
const CHUNK_INTERVAL = 100;

export type MatchProcessorOptions<T extends Detail> = {
  initialItems?: readonly IdItem<T>[];
  initialQuery?: string;
  initialIndex?: number;
  interval?: number;
  threshold?: number;
  chunkSize?: number;
  chunkInterval?: number;
  incremental?: boolean;
};

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

  get items(): IdItem<T>[] {
    return this.#items;
  }

  get matcherCount(): number {
    return this.matchers.count;
  }

  get matcherIndex(): number {
    return this.matchers.index;
  }

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

  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
