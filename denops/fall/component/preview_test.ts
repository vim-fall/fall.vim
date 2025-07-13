import "../lib/polyfill.ts";

import { test } from "@denops/test";
import * as fn from "@denops/std/function";
import { fromFileUrl } from "@std/path/from-file-url";
import { assertEquals } from "@std/assert";

import { PreviewComponent } from "./preview.ts";

const dimension = {
  col: 1,
  row: 1,
  width: 10,
  height: 5,
};

const runtimepath = fromFileUrl(new URL("../../../", import.meta.url));

test({
  mode: "all",
  name: "PreviewComponent",
  prelude: [
    `set runtimepath+=${runtimepath}`,
    `runtime plugin/fall/*.vim`,
  ],
  fn: async (denops, t) => {
    await t.step("render", async (t) => {
      await t.step("renders content fairly", async () => {
        await using component = new PreviewComponent();
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "No preview",
        ]);

        component.item = {
          content: [
            "**Hello, world!**",
            "**Hello, world!**",
            "**Hello, world!**",
          ],
          filename: "test.md",
          line: 2,
          column: 3,
        };
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "**Hello, world!**",
          "**Hello, world!**",
          "**Hello, world!**",
        ]);
        assertEquals(
          await fn.bufname(denops, info.bufnr),
          "fall://preview/test.md",
        );
        assertEquals(
          await fn.getbufvar(denops, info.bufnr, "&filetype"),
          "markdown",
        );
        assertEquals(
          await fn.getcurpos(denops, info.winid),
          [0, 2, 3, 0, 3],
        );

        component.item = {
          ...component.item!,
          filetype: "vim",
          line: 3,
          column: 4,
        };
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "**Hello, world!**",
          "**Hello, world!**",
          "**Hello, world!**",
        ]);
        assertEquals(
          await fn.bufname(denops, info.bufnr),
          "fall://preview/test.md",
        );
        assertEquals(
          await fn.getbufvar(denops, info.bufnr, "&l:filetype"),
          "vim",
        );
        assertEquals(
          await fn.getcurpos(denops, info.winid),
          [0, 3, 4, 0, 4],
        );
      });

      await t.step("renders content properly", async () => {
        await using component = new PreviewComponent({
          realHighlight: true,
        });
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "No preview",
        ]);

        component.item = {
          content: [
            "**Hello, world!**",
            "**Hello, world!**",
            "**Hello, world!**",
          ],
          filename: "test.md",
          line: 2,
          column: 3,
        };
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "**Hello, world!**",
          "**Hello, world!**",
          "**Hello, world!**",
        ]);
        assertEquals(
          await fn.bufname(denops, info.bufnr),
          "fall://preview/test.md",
        );
        assertEquals(
          await fn.getbufvar(denops, info.bufnr, "&filetype"),
          "markdown",
        );
        assertEquals(
          await fn.getcurpos(denops, info.winid),
          [0, 2, 3, 0, 3],
        );

        component.item = {
          ...component.item!,
          filetype: "vim",
          line: 3,
          column: 4,
        };
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "**Hello, world!**",
          "**Hello, world!**",
          "**Hello, world!**",
        ]);
        assertEquals(
          await fn.bufname(denops, info.bufnr),
          "fall://preview/test.md",
        );
        assertEquals(
          await fn.getbufvar(denops, info.bufnr, "&filetype"),
          "vim",
        );
        assertEquals(
          await fn.getcurpos(denops, info.winid),
          [0, 3, 4, 0, 4],
        );
      });
    });
  },
});
