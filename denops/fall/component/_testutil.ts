import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";
import { collect } from "@denops/std/batch";
import * as iterutil from "@core/iterutil/pipe";
import { range } from "@core/iterutil";
import { pipe } from "@core/pipe";

/**
 * Get screen text in the specified range.
 *
 * > [!WARN]
 * > It seems 'screenstring' doesn't work on Vim when `-es` option is specified.
 * > So test using this function only works on Neovim.
 */
export async function screentext(
  denops: Denops,
  row: number,
  col: number,
  width: number,
  height: number,
): Promise<string[]> {
  const ps = Array.from(pipe(
    range(row, row + height - 1),
    iterutil.map((row) =>
      pipe(
        range(col, col + width - 1),
        iterutil.map((col) => [row, col] as const),
      )
    ),
    iterutil.flatten,
  ));
  const strings = await collect(
    denops,
    (denops) => ps.map((p) => fn.screenstring(denops, ...p)),
  );
  return Array.from(
    pipe(
      strings,
      iterutil.chunked(width),
      iterutil.map((line) => line.join("")),
    ),
  );
}
