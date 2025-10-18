import type { Entrypoint } from "jsr:@vim-fall/custom@^0.1.0";
import * as builtin from "jsr:@vim-fall/std@^0.13.0/builtin";

export const main: Entrypoint = ({
  definePickerFromSource,
  definePickerFromCurator,
}) => {
  definePickerFromCurator("git-grep", builtin.curator.gitGrep, {
    previewers: [builtin.previewer.file],
    actions: {
      ...builtin.action.defaultOpenActions,
      ...builtin.action.defaultSystemopenActions,
      ...builtin.action.defaultQuickfixActions,
    },
    defaultAction: "open",
  });

  definePickerFromSource("file", builtin.source.file, {
    matchers: [builtin.matcher.fzf],
    previewers: [builtin.previewer.file],
    actions: {
      ...builtin.action.defaultOpenActions,
      ...builtin.action.defaultSystemopenActions,
      ...builtin.action.defaultQuickfixActions,
    },
    defaultAction: "open",
  });
};
