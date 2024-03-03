import type { Denops } from "https://deno.land/x/denops_std@v6.3.0/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.16.3/mod.ts";

import type { Action } from "../../fall/types.ts";

const isOptions = is.StrictOf(is.PartialOf(is.ObjectOf({})));

export default function factory(
  _denops: Denops,
  options: Record<string, unknown>,
): Action {
  assert(options, isOptions);
  return (_denops, items) => {
    for (const item of items) {
      console.log(JSON.stringify(item));
    }
  };
}
