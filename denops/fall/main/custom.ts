import type { Entrypoint } from "@denops/std";
import { as, assert, is } from "@core/unknownutil";

import {
  editUserCustom,
  loadUserCustom,
  recacheUserCustom,
} from "../custom.ts";
import { withHandleError } from "../error.ts";

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    ...denops.dispatcher,
    "custom:edit": withHandleError(denops, (options = {}) => {
      assert(options, isEditOptions);
      return editUserCustom(denops, options);
    }),
    "custom:reload": withHandleError(denops, (options = {}) => {
      assert(options, isReloadOptions);
      return loadUserCustom(denops, { verbose: options.verbose, reload: true });
    }),
    "custom:recache": withHandleError(denops, (options = {}) => {
      assert(options, isRecacheOptions);
      return recacheUserCustom(denops, {
        ...options,
        signal: denops.interrupted,
      });
    }),
  };
};

const isEditOptions = is.ObjectOf({
  bang: as.Optional(is.Boolean),
  mods: as.Optional(is.String),
  opener: as.Optional(is.String),
  cmdarg: as.Optional(is.String),
});

const isReloadOptions = is.ObjectOf({
  verbose: as.Optional(is.Boolean),
});

const isRecacheOptions = is.ObjectOf({
  verbose: as.Optional(is.Boolean),
});
