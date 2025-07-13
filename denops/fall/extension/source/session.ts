import type { Source } from "@vim-fall/core/source";
import type { DetailUnit, IdItem } from "@vim-fall/core/item";
import type { PickerSession } from "../../session.ts";
import { listPickerSessions } from "../../session.ts";

export type Detail = PickerSession<DetailUnit>;

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
