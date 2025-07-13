import type { Detail } from "@vim-fall/core/item";
import type { Source } from "@vim-fall/core/source";
import type { Action } from "@vim-fall/core/action";

/**
 * Create a source for actions.
 */
export function action(
  actions: Record<string, Action<Detail>>,
): Source<Action<Detail>> {
  return {
    collect: async function* () {
      yield* Object.entries(actions).map(([name, action], id) => ({
        id,
        value: name,
        detail: action,
      }));
    },
  };
}
