import type { Detail, IdItem } from "@vim-fall/core/item";
import type { Source } from "@vim-fall/core/source";

/**
 * Create a source from a list
 */
export function list<T extends Detail>(items: readonly IdItem<T>[]): Source<T> {
  return {
    collect: async function* () {
      yield* items;
    },
  };
}
