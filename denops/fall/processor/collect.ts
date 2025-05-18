import type { Denops } from "jsr:@denops/std@^7.3.2";
import { take } from "jsr:@core/iterutil@^0.9.0/async/take";
import { map } from "jsr:@core/iterutil@^0.9.0/map";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { CollectParams, Source } from "jsr:@vim-fall/core@^0.3.0/source";

import { Chunker } from "../lib/chunker.ts";
import { dispatch } from "../event.ts";

const THRESHOLD = 100000;
const CHUNK_SIZE = 1000;

export type CollectProcessorOptions = {
  threshold?: number;
  chunkSize?: number;
};

export class CollectProcessor<T extends Detail> implements Disposable {
  readonly #controller: AbortController = new AbortController();
  readonly #items: IdItem<T>[] = [];
  readonly #source: Source<T>;
  readonly #threshold: number;
  readonly #chunkSize: number;
  #processing?: Promise<void>;
  #paused?: PromiseWithResolvers<void>;

  constructor(
    source: Source<T>,
    options: CollectProcessorOptions = {},
  ) {
    this.#source = source;
    this.#threshold = options.threshold ?? THRESHOLD;
    this.#chunkSize = options.chunkSize ?? CHUNK_SIZE;
  }

  get items() {
    return this.#items;
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
        this.#source.collect(denops, params, { signal }),
        this.#threshold,
      );
      const update = (chunk: Iterable<IdItem<T>>) => {
        const offset = this.#items.length;
        this.#items.push(
          ...map(chunk, (item, i) => ({ ...item, id: i + offset })),
        );
        dispatch({ type: "collect-processor-updated" });
      };
      const chunker = new Chunker<IdItem<T>>(this.#chunkSize);
      for await (const item of iter) {
        if (this.#paused) await this.#paused.promise;
        signal.throwIfAborted();
        if (chunker.put(item)) {
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

  #resume(): void {
    if (!this.#paused) {
      return;
    }
    this.#paused.resolve();
    this.#paused = undefined;
  }

  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
