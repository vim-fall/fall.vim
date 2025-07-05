import type { Denops } from "jsr:@denops/std@^7.3.2";
import type {
  Detail,
  DisplayItem,
  IdItem,
} from "jsr:@vim-fall/core@^0.3.0/item";
import type { Renderer } from "jsr:@vim-fall/core@^0.3.0/renderer";

import { adjustOffset } from "../lib/adjust_offset.ts";
import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

const HEIGHT = 10;
const SCROLL_OFFSET = 2;

export type RenderProcessorOptions = {
  height?: number;
  scrollOffset?: number;
};

export class RenderProcessor<T extends Detail> implements Disposable {
  readonly #controller: AbortController = new AbortController();
  readonly renderers: ItemBelt<Renderer<T>>;
  #height: number;
  #scrollOffset: number;
  #processing?: Promise<void>;
  #reserved?: () => void;
  #items: DisplayItem<T>[] = [];
  #itemCount: number = 0;
  #cursor: number = 0;
  #offset: number = 0;

  constructor(
    renderers: readonly Renderer<T>[],
    options: RenderProcessorOptions = {},
  ) {
    this.renderers = new ItemBelt(renderers);
    this.#height = options.height ?? HEIGHT;
    this.#scrollOffset = options.scrollOffset ?? SCROLL_OFFSET;
  }

  get #renderer(): Renderer<T> | undefined {
    return this.renderers.current;
  }

  get rendererCount(): number {
    return this.renderers.count;
  }

  get rendererIndex(): number {
    return this.renderers.index;
  }

  set rendererIndex(index: number | "$") {
    if (index === "$") {
      index = this.renderers.count;
    }
    this.renderers.index = index;
  }

  get items() {
    return this.#items;
  }

  get line(): number {
    return this.#cursor - this.#offset + 1;
  }

  get cursor(): number {
    return this.#cursor;
  }

  set cursor(cursor: number | "$") {
    if (cursor === "$") {
      cursor = this.#itemCount - 1;
    }
    this.#adjustCursor(cursor);
    this.#adjustOffset();
  }

  #adjustCursor(cursor?: number): void {
    cursor = cursor ?? this.cursor;
    if (cursor < 0) {
      cursor = 0;
    } else if (cursor >= this.#itemCount) {
      cursor = this.#itemCount - 1;
    }
    this.#cursor = cursor;
  }

  get offset(): number {
    return this.#offset;
  }

  #adjustOffset(offset?: number): void {
    this.#offset = adjustOffset(
      offset ?? this.offset,
      this.cursor,
      this.#itemCount,
      this.#height,
      this.#scrollOffset,
    );
  }

  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    this.#height = height;
    this.#adjustOffset();
  }

  get scrollOffset(): number {
    return this.#scrollOffset;
  }

  set scrollOffset(offset: number) {
    this.#scrollOffset = offset;
    this.#adjustOffset();
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
    { items }: { items: readonly Readonly<IdItem<T>>[] },
  ): void {
    this.#validateAvailability();
    if (this.#processing) {
      // Keep most recent start request for later.
      this.#reserved = () => this.start(denops, { items });
      return;
    }
    this.#processing = (async () => {
      dispatch({ type: "render-processor-started" });
      const signal = this.#controller.signal;

      this.#itemCount = items.length;
      this.#adjustCursor();
      this.#adjustOffset();

      const displayItems = items
        .slice(this.offset, this.offset + this.height)
        .map((v) => ({
          ...v,
          label: v.label ?? v.value,
          decorations: v.decorations ?? [],
        }));

      await this.#renderer?.render(
        denops,
        { items: displayItems },
        { signal },
      );
      signal.throwIfAborted();

      this.#items = displayItems;
      dispatch({ type: "render-processor-succeeded" });
    })();
    this.#processing
      .catch((err) => {
        dispatch({ type: "render-processor-failed", err });
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
