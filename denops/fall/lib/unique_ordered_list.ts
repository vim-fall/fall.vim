/**
 * A function that extracts a unique identifier from an item.
 * The identifier is used to determine uniqueness in the list.
 *
 * @template T - The type of items in the list
 * @param item - The item to extract an identifier from
 * @returns A value that uniquely identifies the item
 */
export type Identifier<T> = (item: T) => unknown;

export type UniqueOrderedListOptions<T> = {
  /**
   * A function to extract a unique identifier from items.
   * If not provided, items themselves are used as identifiers.
   */
  identifier?: Identifier<T>;
};

/**
 * A list that maintains insertion order while ensuring all items are unique.
 *
 * This class provides a data structure that combines the properties of an array
 * (ordered) and a set (unique items). Items are kept in the order they were first
 * added, and duplicate items (as determined by the identifier function) are ignored.
 *
 * @template T - The type of items stored in the list
 *
 * @example
 * ```typescript
 * type User = { id: number; name: string };
 *
 * // Using with objects and custom identifier
 * const users = new UniqueOrderedList<User>([], {
 *   identifier: (user) => user.id
 * });
 * users.push({ id: 1, name: "Alice" });
 * users.push({ id: 2, name: "Bob" });
 * users.push({ id: 1, name: "Alice Updated" }); // Ignored due to duplicate id
 * console.log(users.items); // [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
 *
 * // Using with primitives (default identifier)
 * const numbers = new UniqueOrderedList<number>();
 * numbers.push(3, 1, 4, 1, 5, 9); // Duplicates are ignored
 * console.log(numbers.items); // [3, 1, 4, 5, 9]
 *
 * // Initializing with items (duplicates are filtered)
 * const nums = new UniqueOrderedList<number>([1, 2, 3, 2, 1]);
 * console.log(nums.items); // [1, 2, 3]
 * ```
 */
export class UniqueOrderedList<T> {
  #seen: Set<unknown> = new Set();
  #identifier: Identifier<T>;
  #items: T[];

  /**
   * Creates a new UniqueOrderedList instance.
   *
   * @param init - Optional array of initial items. Duplicates will be filtered out.
   * @param options - Optional configuration object
   * @param options.identifier - Function to extract unique identifiers from items.
   *                             If not provided, items themselves are used as identifiers.
   */
  constructor(init?: readonly T[], options?: UniqueOrderedListOptions<T>) {
    this.#identifier = options?.identifier ?? ((item) => item);
    this.#items = Array.from(this.#uniq(init?.slice() ?? []));
  }

  /**
   * Gets a readonly array of all items in the list.
   * Items are returned in the order they were first added.
   *
   * @returns A readonly array containing all unique items
   */
  get items(): readonly T[] {
    return this.#items;
  }

  /**
   * Gets the number of unique items in the list.
   *
   * @returns The count of unique items
   */
  get size(): number {
    return this.#items.length;
  }

  *#uniq(items: Iterable<T>): Iterable<T> {
    const seen = this.#seen;
    const identifier = this.#identifier;
    for (const item of items) {
      const id = identifier(item);
      if (!seen.has(id)) {
        seen.add(id);
        yield item;
      }
    }
  }

  /**
   * Adds one or more items to the list.
   *
   * Items are added in the order provided, but only if their identifier
   * hasn't been seen before. Duplicate items (based on the identifier) are
   * silently ignored and do not affect the existing order.
   *
   * @param items - The items to add to the list
   */
  push(...items: readonly T[]): void {
    for (const item of this.#uniq(items)) {
      this.#items.push(item);
    }
  }
}
