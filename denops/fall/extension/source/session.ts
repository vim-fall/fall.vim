import type { Source } from "jsr:@vim-fall/core@^0.3.0/source";
import type { DetailUnit, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { PickerSessionCompressed } from "../../session.ts";
import { listPickerSessions } from "../../session.ts";

export type Detail = PickerSessionCompressed<DetailUnit>;

export function session(): Source<Detail> {
  return {
    collect: async function* (): AsyncIterableIterator<IdItem<Detail>> {
      const sessions = listPickerSessions();
      yield* sessions.map((session, index) => {
        const number = index + 1;
        return {
          id: index,
          value: `#${number}`,
          detail: session,
        };
      });
    },
  };
}
