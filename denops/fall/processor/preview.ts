import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Detail, PreviewItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type {
  Previewer,
  PreviewParams,
} from "jsr:@vim-fall/core@^0.3.0/previewer";

import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

export type PreviewProcessorOptions = {
  initialIndex?: number;
};

export class PreviewProcessor<T extends Detail> implements Disposable {
  readonly #controller: AbortController = new AbortController();
  readonly previewers: ItemBelt<Previewer<T>>;
  #processing?: Promise<void>;
  #reserved?: () => void;
  #item: PreviewItem | undefined = undefined;

  constructor(
    previewers: readonly Previewer<T>[],
    options: PreviewProcessorOptions = {},
  ) {
    this.previewers = new ItemBelt(previewers, {
      index: options.initialIndex,
    });
  }

  get #previewer(): Previewer<T> | undefined {
    return this.previewers.current;
  }

  get previewerCount(): number {
    return this.previewers.count;
  }

  get previewerIndex(): number {
    return this.previewers.index;
  }

  set previewerIndex(index: number | "$") {
    if (index === "$") {
      index = this.previewers.count;
    }
    this.previewers.index = index;
  }

  get item(): PreviewItem | undefined {
    return this.#item;
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

  start(denops: Denops, { item }: PreviewParams<T>): void {
    this.#validateAvailability();
    if (this.#processing) {
      // Keep most recent start request for later.
      this.#reserved = () => this.start(denops, { item });
      return;
    }
    this.#processing = (async () => {
      dispatch({ type: "preview-processor-started" });
      const signal = this.#controller.signal;
      if (!item) {
        this.#item = undefined;
      } else {
        const previewItem = await this.#previewer?.preview(
          denops,
          { item },
          { signal },
        );
        signal.throwIfAborted();

        this.#item = previewItem ?? undefined;
      }
      dispatch({ type: "preview-processor-succeeded" });
    })();
    this.#processing
      .catch((err) => {
        dispatch({ type: "preview-processor-failed", err });
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
