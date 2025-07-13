import type { Action } from "@vim-fall/core/action";
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
