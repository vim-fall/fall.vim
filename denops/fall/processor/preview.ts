/**
 * @module processor/preview
 *
 * Preview processor for vim-fall.
 *
 * This module provides the PreviewProcessor class which generates preview
 * content for selected items. It supports:
 *
 * - Multiple previewer implementations (file, buffer, help, etc.)
 * - Asynchronous preview generation
 * - Dynamic previewer switching
 * - Cancellation of long-running preview operations
 *
 * The processor works with the preview component to display item details
 * before the user makes a selection.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Detail, PreviewItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type {
  Previewer,
  PreviewParams,
} from "jsr:@vim-fall/core@^0.3.0/previewer";

import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

/**
 * Configuration options for the PreviewProcessor.
 */
export type PreviewProcessorOptions = {
  /** Initial previewer index to use */
  initialIndex?: number;
};

/**
 * Processor responsible for generating preview content for items.
 *
 * The PreviewProcessor uses configured previewers to generate preview
 * content for the currently selected item. Preview generation is
 * asynchronous and can be cancelled if the user navigates away.
 *
 * @template T - The type of detail data associated with each item
 *
 * @example
 * ```typescript
 * const processor = new PreviewProcessor([
 *   file(),
 *   buffer(),
 *   help(),
 * ]);
 *
 * // Start preview generation
 * processor.start(denops, { item: selectedItem });
 *
 * // Access preview content
 * if (processor.item) {
 *   console.log("Preview:", processor.item.content);
 * }
 * ```
 */
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

  /**
   * Gets the total number of available previewers.
   */
  get previewerCount(): number {
    return this.previewers.count;
  }

  /**
   * Gets the current previewer index.
   */
  get previewerIndex(): number {
    return this.previewers.index;
  }

  /**
   * Sets the current previewer index.
   *
   * @param index - The previewer index or "$" for the last previewer
   */
  set previewerIndex(index: number | "$") {
    if (index === "$") {
      index = this.previewers.count;
    }
    this.previewers.index = index;
  }

  /**
   * Gets the generated preview item.
   *
   * @returns The preview content or undefined if no preview is available
   */
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

  /**
   * Starts the preview generation process.
   *
   * This method generates preview content for the provided item using
   * the current previewer. If no item is provided, the preview is cleared.
   * Preview generation is asynchronous and can be cancelled.
   *
   * The method emits:
   * - `preview-processor-started`: When preview generation begins
   * - `preview-processor-succeeded`: When preview is ready
   * - `preview-processor-failed`: If an error occurs
   *
   * @param denops - The Denops instance
   * @param params - Object containing the item to preview
   *
   * @example
   * ```typescript
   * // Generate preview for an item
   * processor.start(denops, { item: selectedItem });
   *
   * // Clear preview
   * processor.start(denops, { item: undefined });
   * ```
   */
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

  /**
   * Disposes of the processor and cancels any ongoing preview generation.
   *
   * This method is called automatically when the processor is no longer needed.
   * It aborts the preview process and cleans up resources.
   */
  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
