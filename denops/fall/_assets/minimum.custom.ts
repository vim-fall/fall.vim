import type { Entrypoint } from "@vim-fall/custom";
import * as builtin from "@vim-fall/std/builtin";

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
