import "../lib/polyfill.ts";

import { assertEquals } from "@std/assert";
import { delay } from "@std/async";
import { test } from "@denops/test";
import { fromFileUrl } from "@std/path/from-file-url";
import { listDecorations } from "@denops/std/buffer";
import * as fn from "@denops/std/function";

import {
  HIGHLIGHT_COUNTER,
  HIGHLIGHT_CURSOR,
  HIGHLIGHT_HEADER,
  InputComponent,
} from "./input.ts";

const runtimepath = fromFileUrl(new URL("../../..", import.meta.url));

const dimension = {
  col: 1,
  row: 1,
  width: 11,
  height: 5,
};

test({
  mode: "all",
  name: "InputComponent",
  prelude: [
    `set runtimepath+=${runtimepath}`,
    `runtime plugin/fall/*.vim`,
  ],
  fn: async (denops, t) => {
    await t.step("render", async (t) => {
      await t.step("renders content properly", async () => {
        await using component = new InputComponent();
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          ">       0/0",
        ]);

        // Hello, world!
        // ||||-
        // ^
        component.cmdline = "Hello, world!";
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hello 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 2,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        // ||||-
        //  ^
        component.cmdpos = 1;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hello 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 3,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        // ||||-
        //   ^
        component.cmdpos = 2;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hello 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //  ||||-
        //    ^
        component.cmdpos = 3;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> ello, 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //   ||||-
        //     ^
        component.cmdpos = 4;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> llo,  0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //    ||||-
        //      ^
        component.cmdpos = 5;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> lo, w 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //     ||||-
        //       ^
        component.cmdpos = 6;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> o, wo 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //      ||||-
        //        ^
        component.cmdpos = 7;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> , wor 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //       ||||-
        //         ^
        component.cmdpos = 8;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          ">  worl 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //        ||||-
        //          ^
        component.cmdpos = 9;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> world 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //         ||||-
        //           ^
        component.cmdpos = 10;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> orld! 0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //          ||||-
        //            ^
        component.cmdpos = 11;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> rld!  0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 4,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //          ||||-
        //             ^
        component.cmdpos = 12;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> rld!  0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 5,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);

        // Hello, world!
        //          ||||-
        //              ^
        component.cmdpos = 13;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> rld!  0/0",
        ]);
        assertEquals(await listDecorations(denops, info.bufnr), [
          {
            column: 1,
            highlight: HIGHLIGHT_HEADER,
            length: 2,
            line: 1,
          },
          {
            column: 6,
            highlight: HIGHLIGHT_CURSOR,
            length: 1,
            line: 1,
          },
          {
            column: 8,
            highlight: HIGHLIGHT_COUNTER,
            length: 4,
            line: 1,
          },
        ]);
      });

      await t.step("renders prefix properly (processing)", async () => {
        await using component = new InputComponent();
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          ">       0/0",
        ]);

        component.cmdline = "Hello, world!";
        component.processing = true;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "⣷ Hello 0/0",
        ]);

        await delay(150);
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "⣯ Hello 0/0",
        ]);

        await delay(150);
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "⣟ Hello 0/0",
        ]);

        component.processing = "failed";
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "✕ Hello 0/0",
        ]);
      });

      await t.step("renders suffix properly (collecting)", async () => {
        await using component = new InputComponent();
        await component.open(denops, dimension);
        await component.render(denops);
        await denops.cmd("redraw");

        const info = component.info!;
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          ">       0/0",
        ]);

        component.cmdline = "Hello, world!";
        component.processed = 1;
        component.collected = 2;
        component.collecting = true;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hel 1/2 ⣷",
        ]);

        await delay(150);
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hel 1/2 ⣯",
        ]);

        await delay(150);
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hel 1/2 ⣟",
        ]);

        component.collecting = "failed";
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> Hel 1/2 ✕",
        ]);

        component.truncated = true;
        await component.render(denops);
        await denops.cmd("redraw");
        assertEquals(await fn.getbufline(denops, info.bufnr, 1, "$"), [
          "> el 1/2+ ✕",
        ]);
      });
    });
  },
});
