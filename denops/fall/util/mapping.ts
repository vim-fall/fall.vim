import type { Denops } from "jsr:@denops/std@^7.3.2";
import * as mapping from "jsr:@denops/std@^7.3.2/mapping";
import { chunked } from "jsr:@core/iterutil@^0.9.0/chunked";
import { range } from "jsr:@core/iterutil@^0.9.0/range";

import type { Page } from "../component/help.ts";

const HIGHLIGHT_LHS = "FallHelpMappingLhs";
const HIGHLIGHT_RHS = "FallHelpMappingRhs";
const HIGHLIGHT_OPERATOR = "FallHelpMappingOperator";

export async function buildMappingHelpPages(
  denops: Denops,
  width: number,
  height: number,
): Promise<Page[]> {
  // Collect mappings
  const mappings = await mapping.list(denops, "", { mode: "c" });
  const pattern = /^<Plug>\(fall-([^)]+)\)$/;
  const records = mappings
    .filter((m) => pattern.test(m.rhs))
    .map((m) => ({
      lhs: m.lhs,
      rhs: m.rhs.replace(pattern, "$1"),
    }));
  return formatMappingHelpPage(width, height, records);
}

function formatMappingHelpPage(
  width: number,
  height: number,
  mappings: { lhs: string; rhs: string }[],
): Page[] {
  const operator = " ➙ ";
  const spacer = "    ";
  const lhsWidth = Math.max(...mappings.map(({ lhs }) => getByteLength(lhs)));
  const rhsWidth = Math.max(...mappings.map(({ rhs }) => getByteLength(rhs)));
  const columnWidth = Math.min(
    width,
    lhsWidth + rhsWidth + operator.length + spacer.length,
  );
  const columnCount = Math.floor(width / columnWidth);
  const recordWidth = columnWidth - spacer.length;
  const records = mappings
    .toSorted((a, b) => `${a.rhs}${a.lhs}`.localeCompare(`${b.rhs}${b.lhs}`))
    .map(({ lhs, rhs }) => {
      const r = `${lhs.padStart(lhsWidth)}${operator}${rhs}`;
      if (r.length < recordWidth) {
        return r.padEnd(recordWidth, " ");
      } else if (r.length > recordWidth) {
        return r.slice(0, recordWidth - 1) + "…";
      } else {
        return r;
      }
    });
  const pages = [...chunked(chunked(records, height), columnCount)];
  return pages.map((columns) => {
    const content = [...range(0, height)]
      .map((_, i) => {
        return columns
          .map((column) => column[i] ?? " ".repeat(columnWidth))
          .join(spacer);
      })
      .filter((c) => c.trim() !== "");
    const decorations = [...range(1, height)]
      .map((line) => {
        return [...range(0, columns.length - 1)]
          .map((x) => {
            const offset = 1 + x * (columnWidth + getByteLength(spacer) / 2);
            return [
              {
                line,
                column: offset,
                length: lhsWidth,
                highlight: HIGHLIGHT_LHS,
              },
              {
                line,
                column: offset + lhsWidth,
                length: getByteLength(operator),
                highlight: HIGHLIGHT_OPERATOR,
              },
              {
                line,
                column: offset + lhsWidth + getByteLength(operator),
                length: rhsWidth,
                highlight: HIGHLIGHT_RHS,
              },
            ];
          })
          .flat();
      })
      .flat();
    return { content, decorations };
  });
}

const encoder = new TextEncoder();

function getByteLength(str: string): number {
  return encoder.encode(str).length;
}
