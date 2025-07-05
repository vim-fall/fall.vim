/**
 * Options for configuring an ItemBelt instance.
 */
export type ItemBeltOptions = {
  /**
   * The initial index to set for the ItemBelt.
   * If not provided, defaults to 0.
   */
  index?: number;
};

/**
 * A class representing an item belt, which provides functionality for managing
 * and selecting items in a list with wrap-around and bounded selection.
 *
 * @template T The type of items contained in the belt.
 */
export class ItemBelt<T> {
  #index: number = 0;
  #items: readonly T[];

  /**
   * Creates an instance of ItemBelt with the specified items.
   *
   * @param items An array of items of type T to initialize the belt.
   * @param options Optional configuration for the ItemBelt.
   * @param options.index The initial index to set (default is 0).
   */
  constructor(items: readonly T[], options?: ItemBeltOptions) {
    this.#items = items;
    this.index = options?.index ?? 0;
  }

  /**
   * Gets the number of items in the belt.
   *
   * @returns The number of items in the belt.
   */
  get count(): number {
    return this.#items.length;
  }

  /**
   * Gets the current item in the belt based on the current index.
   * Returns `undefined` if `items` is empty.
   *
   * @returns The current item of type T, or `undefined` if the `items` list is empty.
   */
  get current(): T | undefined {
    return this.#items.at(this.#index);
  }

  /**
   * Gets all the items in the belt.
   *
   * @returns An array of items of type T.
   */
  get items(): readonly T[] {
    return this.#items;
  }

  /**
   * Sets the items in the belt and resets the index to the current position.
   *
   * @param items An array of items to set in the belt.
   */
  set items(items: readonly T[]) {
    this.#items = items;
    this.index = this.#index;
  }

  /**
   * Gets the current index of the belt, which indicates the position of the
   * current item in the items list.
   *
   * @returns The current index as a number.
   */
  get index(): number {
    return this.#index;
  }

  /**
   * Sets the index of the belt. If the provided index is out of bounds, it is
   * adjusted to be within the valid range (0 to items.length - 1).
   *
   * @param index The new index to set. If it is out of bounds, it will be clipped
   *              to the nearest valid value.
   */
  set index(index: number) {
    if (this.#items.length === 0) {
      index = 0;
    } else if (index >= this.#items.length) {
      index = this.#items.length - 1;
    } else if (index < 0) {
      index = 0;
    }
    this.#index = index;
  }

  /**
   * Selects a new item based on the current index, with an optional offset.
   * The selection can optionally cycle through the items list.
   *
   * @param offset The number of positions to move the index (default is 1).
   * @param options Optional configuration for the selection.
   * @param options.cycle Whether to cycle through the list (default is `false`).
   */
  select(offset = 1, { cycle = false } = {}): void {
    let index = this.#index + offset;
    if (cycle) {
      index = (index + this.#items.length) % this.#items.length;
    }
    this.index = index;
  }
}
