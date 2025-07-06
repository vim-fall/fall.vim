/**
 * @module processor/sort
 *
 * Sorting processor for vim-fall.
 *
 * This module provides the SortProcessor class which orders filtered items
 * using configurable sorters. It supports:
 *
 * - Multiple sorter implementations (alphabetical, length, score-based)
 * - Dynamic sorter switching during runtime
 * - In-place sorting for efficiency
 * - Asynchronous processing with proper cancellation
 *
 * The processor transforms filtered items into sorted items, maintaining
 * the pipeline flow from matcher to renderer.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { Sorter } from "jsr:@vim-fall/core@^0.3.0/sorter";

import { ItemBelt } from "../lib/item_belt.ts";
import { dispatch } from "../event.ts";

/**
 * Configuration options for the SortProcessor.
 */
export type SortProcessorOptions = {
  /** Initial sorter index to use */
  initialIndex?: number;
};

/**
 * Processor responsible for sorting filtered items.
 *
 * The SortProcessor applies sorters to order items after they've been
 * filtered by the matcher. Sorting is performed in-place on the item
 * array for efficiency. Multiple sorters can be configured and switched
 * between dynamically.
 *
 * @template T - The type of detail data associated with each item
 *
 * @example
 * ```typescript
 * const processor = new SortProcessor([
 *   alphabetical(),
 *   byLength(),
 *   byScore(),
 * ]);
 *
 * // Start sorting
 * processor.start(denops, { items: filteredItems });
 *
 * // Switch sorter
 * processor.sorterIndex = 1;
 * ```
 */
export class SortProcessor<T extends Detail> implements Disposable {
  readonly #controller: AbortController = new AbortController();
  readonly sorters: ItemBelt<Sorter<T>>;
  #processing?: Promise<void>;
  #reserved?: () => void;
  #items: IdItem<T>[] = [];

  constructor(
    sorters: readonly Sorter<T>[],
    options: SortProcessorOptions = {},
  ) {
    this.sorters = new ItemBelt(sorters, {
      index: options.initialIndex,
    });
  }

  get #sorter(): Sorter<T> | undefined {
    return this.sorters.current;
  }

  /**
   * Gets the total number of available sorters.
   */
  get sorterCount(): number {
    return this.sorters.count;
  }

  /**
   * Gets the current sorter index.
   */
  get sorterIndex(): number {
    return this.sorters.index;
  }

  /**
   * Sets the current sorter index.
   *
   * @param index - The sorter index or "$" for the last sorter
   */
  set sorterIndex(index: number | "$") {
    if (index === "$") {
      index = this.sorters.count;
    }
    this.sorters.index = index;
  }

  /**
   * Gets the sorted items.
   *
   * @returns The items after sorting has been applied
   */
  get items(): readonly IdItem<T>[] {
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

  /**
   * Starts the sorting process.
   *
   * This method sorts the provided items using the current sorter.
   * Sorting is performed in-place on the items array for efficiency.
   * If no sorter is configured, items are passed through unchanged.
   *
   * The method emits:
   * - `sort-processor-started`: When sorting begins
   * - `sort-processor-succeeded`: When sorting completes
   * - `sort-processor-failed`: If an error occurs
   *
   * @param denops - The Denops instance
   * @param params - Object containing the items to sort
   *
   * @example
   * ```typescript
   * processor.start(denops, { items: filteredItems });
   * ```
   */
  start(denops: Denops, { items }: { items: readonly IdItem<T>[] }): void {
    this.#validateAvailability();
    if (this.#processing) {
      // Keep most recent start request for later.
      this.#reserved = () => this.start(denops, { items });
      return;
    }
    this.#processing = (async () => {
      dispatch({ type: "sort-processor-started" });
      const signal = this.#controller.signal;

      // Create a shallow copy of the items array
      const cloned = items.slice();

      await this.#sorter?.sort(
        denops,
        { items: cloned },
        { signal },
      );
      signal.throwIfAborted();

      this.#items = cloned;
      dispatch({ type: "sort-processor-succeeded" });
    })();
    this.#processing
      .catch((err) => {
        dispatch({ type: "sort-processor-failed", err });
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
   * Disposes of the processor and cancels any ongoing sorting.
   *
   * This method is called automatically when the processor is no longer needed.
   * It aborts the sorting process and cleans up resources.
   */
  [Symbol.dispose](): void {
    try {
      this.#controller.abort(null);
    } catch {
      // Ignore
    }
  }
}
