import type {
  Item,
  SourceItem,
} from "https://deno.land/x/fall_core@v0.6.0/mod.ts";

import { ChunkStream } from "../../util/stream.ts";
import { dispatch } from "../../util/event.ts";

export interface ItemCollectorParams {
  chunkSize?: number;
}

/**
 * Collect items from the given stream and store them in the internal state.
 */
export class ItemCollector implements Disposable {
  #stream: ReadableStream<SourceItem>;
  #chunkSize: number;

  #controller?: AbortController;
  #items: Item[] = [];

  constructor(stream: ReadableStream<SourceItem>, params: ItemCollectorParams) {
    this.#stream = stream;
    this.#chunkSize = params.chunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  /**
   * Collected items
   */
  get items(): Item[] {
    return this.#items;
  }

  /**
   * Start collecting items from the source stream.
   *
   * It dispatch the following events:
   *
   * - `item-collector-changed`: When new items are collected.
   * - `item-collector-succeeded`: When collecting items is succeeded.
   * - `item-collector-failed`: When collecting items is failed.
   * - `item-collector-completed`: When collecting items is succeeded or failed.
   *
   * Note that when case of aborting, `item-collector-failed` is not dispatched.
   * To check if the collecting is completed, you should use `item-collector-completed`.
   */
  start(): void {
    if (this.#controller) {
      throw new Error("ItemCollector is already started");
    }
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.#stream
      .pipeThrough(new ChunkStream(this.#chunkSize), { signal })
      .pipeTo(
        new WritableStream({
          write: (chunk) => {
            const offset = this.#items.length;
            this.#items.push(...toItems(chunk, offset));
            dispatch("item-collector-changed", undefined);
          },
        }),
        { signal },
      )
      .then(() => {
        dispatch("item-collector-succeeded", undefined);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn(`[fall] Error in reading source steam: ${err}`);
        dispatch("item-collector-failed", undefined);
      })
      .finally(() => {
        dispatch("item-collector-completed", undefined);
      });
  }

  [Symbol.dispose]() {
    try {
      this.#controller?.abort();
    } catch {
      // Fail silently
    }
  }
}

function toItems(
  items: SourceItem[],
  offset: number,
): Item[] {
  return items.map((v, i) => ({
    detail: {},
    decorations: [],
    ...v,
    id: (i + offset).toString(),
  }));
}

const DEFAULT_CHUNK_SIZE = 200;
