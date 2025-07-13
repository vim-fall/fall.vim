import "../lib/polyfill.ts";

import type { Denops } from "@denops/std";
import { test } from "@denops/test";
import * as fn from "@denops/std/function";
import { listDecorations } from "@denops/std/buffer";
import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path/from-file-url";
import { omit } from "@std/collections/omit";

import {
  HIGHLIGHT_MATCH,
  ListComponent,
  SIGN_GROUP_SELECTED,
  SIGN_SELECTED,
} from "./list.ts";

const runtimepath = fromFileUrl(new URL("../../..", import.meta.url));

const dimension = {
  col: 1,
  row: 1,
  width: 5,
  height: 5,
};

test({
  mode: "all",
  name: "ListComponent",
  prelude: [
    `set runtimepath+=${runtimepath}`,
    `runtime plugin/fall/*.vim`,
  ],
  fn: async (denops, t) => {
    await t.step("render", async (t) => {
      await t.step("renders content properly", async () => {
        await using component = new ListComponent();
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [""]);

        component.items = buildItems(5);
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "Item 1",
          "Item 2",
          "Item 3",
          "Item 4",
          "Item 5",
        ]);
      });

      await t.step(
        "places sign on selected lines",
        async () => {
          await using component = new ListComponent();
          await component.open(denops, dimension);
          await component.render(denops);
          await denops.cmd("redraw");

          const info = component.info!;
          const bufnr = info.bufnr;

          // No content = No sign
          assertEquals(
            await listPlacedSigns(denops, bufnr, SIGN_GROUP_SELECTED),
            [{ bufnr, signs: [] }],
          );

          //   Item 1
          // * Item 2
          //   Item 3
          // * Item 4
          //   Item 5
          component.items = buildItems(5);
          component.selection = new Set([1, 3]);

          await component.render(denops);
          await denops.cmd("redraw");
          assertEquals(
            await listPlacedSigns(denops, bufnr, SIGN_GROUP_SELECTED),
            [{
              bufnr,
              signs: [
                {
                  group: SIGN_GROUP_SELECTED,
                  lnum: 2,
                  name: SIGN_SELECTED,
                  priority: 10,
                },
                {
                  group: SIGN_GROUP_SELECTED,
                  lnum: 4,
                  name: SIGN_SELECTED,
                  priority: 10,
                },
              ],
            }],
          );
        },
      );

      await t.step(
        "applies decorations",
        async () => {
          await using component = new ListComponent();
          await component.open(denops, dimension);
          await component.render(denops);
          await denops.cmd("redraw");

          const info = component.info!;
          const bufnr = info.bufnr;

          // No content = No decorations
          assertEquals(
            await listDecorations(denops, bufnr),
            [],
          );

          component.items = buildItems(5);
          await component.render(denops);
          await denops.cmd("redraw");
          assertEquals(
            await listDecorations(denops, bufnr),
            [
              {
                column: 2,
                highlight: HIGHLIGHT_MATCH,
                length: 2,
                line: 1,
              },
              {
                column: 2,
                highlight: HIGHLIGHT_MATCH,
                length: 2,
                line: 2,
              },
              {
                column: 2,
                highlight: HIGHLIGHT_MATCH,
                length: 2,
                line: 3,
              },
              {
                column: 2,
                highlight: HIGHLIGHT_MATCH,
                length: 2,
                line: 4,
              },
              {
                column: 2,
                highlight: HIGHLIGHT_MATCH,
                length: 2,
                line: 5,
              },
            ],
          );
        },
      );
    });
  },
});

function buildItems(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    value: `Item ${i + 1}`,
    label: `Item ${i + 1}`,
    detail: {},
    decorations: [
      { column: 2, length: 2 },
    ],
  }));
}

async function listPlacedSigns(denops: Denops, bufnr: number, group: string) {
  const signs = await fn.sign_getplaced(denops, bufnr, { group }) as {
    bufnr: number;
    signs: {
      group: string;
      id: number;
      lnum: number;
      name: string;
      priority: number;
    }[];
  }[];
  return signs.map((sign) => ({
    ...sign,
    signs: sign.signs.map((sign) => omit(sign, ["id"])),
  }));
}
