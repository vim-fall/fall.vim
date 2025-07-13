import "../lib/polyfill.ts";

import { test } from "@denops/test";
import * as fn from "@denops/std/function";
import { fromFileUrl } from "@std/path/from-file-url";
import { assertEquals } from "@std/assert";

import { HelpComponent } from "./help.ts";

const dimension = {
  col: 1,
  row: 1,
  width: 10,
  height: 5,
};

const runtimepath = fromFileUrl(new URL("../../../", import.meta.url));

test({
  mode: "all",
  name: "HelpComponent",
  prelude: [
    `set runtimepath+=${runtimepath}`,
    `runtime plugin/fall/*.vim`,
  ],
  fn: async (denops, t) => {
    await t.step("render", async () => {
      await using component = new HelpComponent();
      await component.open(denops, dimension);
      await component.render(denops);
      await denops.cmd("redraw");

      const info = component.info!;
      assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
        "Page 1/0  ",
      ]);

      component.pages = [
        {
          content: [
            "**Help Page 1**",
            "**Introduction**",
          ],
        },
      ];
      await component.render(denops);
      await denops.cmd("redraw");

      // Verify the rendered content
      assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
        "Page 1/1  ",
        "**Help Page 1**",
        "**Introduction**",
      ]);

      component.pages = [
        {
          content: [
            "**Help Page 1**",
            "**Introduction**",
          ],
        },
        {
          content: [
            "**Help Page 2**",
            "**Details**",
          ],
        },
      ];
      component.page = 2;
      await component.render(denops);
      await denops.cmd("redraw");

      // Verify the content after page update
      assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
        "Page 2/2  ",
        "**Help Page 2**",
        "**Details**",
      ]);
    });
  },
});
