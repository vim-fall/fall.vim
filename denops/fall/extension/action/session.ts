import type { Action } from "jsr:@vim-fall/core@^0.3.0/action";
import type { Detail } from "../source/session.ts";

export const defaultSessionActions = {
  resume: {
    invoke: async (denops, { item }) => {
      if (!item) {
        return;
      }
      // we need to use timer_start to avoid nesting pickers
      await denops.cmd(
        `call timer_start(0, { -> execute('FallResume ${item.value}') })`,
      );
    },
  },
} satisfies Record<string, Action<Detail>>;
