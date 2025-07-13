import { assertEquals } from "@std/assert";
import { DenopsStub } from "@denops/test/stub";
import { buildMappingHelpPages } from "./mapping.ts";

const dummyCmapRecords = [
  "c  <C-T>       * <Plug>(fall-list-first)",
  "c  <C-G>       * <Plug>(fall-list-last)",
  "c  <C-P>       * <Plug>(fall-list-prev)",
  "c  <C-N>       * <Plug>(fall-list-next)",
  "c  <C-U>       * <Plug>(fall-list-prev:scroll)",
  "c  <C-D>       * <Plug>(fall-list-next:scroll)",
  "c  <PageUp>    * <Plug>(fall-list-left)",
  "c  <S-PageUp>  * <Plug>(fall-list-left:scroll)",
  "c  <PageDown>  * <Plug>(fall-list-right)",
  "c  <S-PageDown>  * <Plug>(fall-list-right:scroll)",
  "c  <C-,>  * <Plug>(fall-select)",
  "c  <C-.>  * <Plug>(fall-select-all)",
  "c  <C-J>  * <Plug>(fall-select)<Plug>(fall-list-next)",
  "c  <C-K>  * <Plug>(fall-list-prev)<Plug>(fall-select)",
];

Deno.test("buildMappingHelpPages", async (t) => {
  const denops = new DenopsStub({
    call(fn, ..._args) {
      switch (fn) {
        case "execute":
          return Promise.resolve(dummyCmapRecords.join("\n"));
        default:
          throw new Error(`Unexpected call ${fn}`);
      }
    },
  });

  await t.step("1 page 1 column", async () => {
    const pages = await buildMappingHelpPages(denops, 80, 24);
    assertEquals(pages.length, 1);
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-first       ",
      "       <C-G> ➙ list-last        ",
      "  <S-PageUp> ➙ list-left:scroll ",
      "    <PageUp> ➙ list-left        ",
      "       <C-D> ➙ list-next:scroll ",
      "       <C-N> ➙ list-next        ",
      "       <C-U> ➙ list-prev:scroll ",
      "       <C-P> ➙ list-prev        ",
      "<S-PageDown> ➙ list-right:scroll",
      "  <PageDown> ➙ list-right       ",
      "       <C-.> ➙ select-all       ",
      "       <C-,> ➙ select           ",
    ]);
    // Check decorations are correctly set
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 12 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 12 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 12 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });

  await t.step("1 page 2 column", async () => {
    const pages = await buildMappingHelpPages(denops, 80, 7);
    assertEquals(pages.length, 1);
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-first                  <C-P> ➙ list-prev        ",
      "       <C-G> ➙ list-last            <S-PageDown> ➙ list-right:scroll",
      "  <S-PageUp> ➙ list-left:scroll       <PageDown> ➙ list-right       ",
      "    <PageUp> ➙ list-left                   <C-.> ➙ select-all       ",
      "       <C-D> ➙ list-next:scroll            <C-,> ➙ select           ",
      "       <C-N> ➙ list-next                                            ",
      "       <C-U> ➙ list-prev:scroll                                     ",
    ]);
    // Check decorations are correctly set
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
          { line: i + 1, column: 39, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
          { line: i + 1, column: 51, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
          { line: i + 1, column: 56, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });

  await t.step("1 page 3 column", async () => {
    const pages = await buildMappingHelpPages(denops, 120, 4);
    assertEquals(pages.length, 1);
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-first                  <C-D> ➙ list-next:scroll     <S-PageDown> ➙ list-right:scroll",
      "       <C-G> ➙ list-last                   <C-N> ➙ list-next              <PageDown> ➙ list-right       ",
      "  <S-PageUp> ➙ list-left:scroll            <C-U> ➙ list-prev:scroll            <C-.> ➙ select-all       ",
      "    <PageUp> ➙ list-left                   <C-P> ➙ list-prev                   <C-,> ➙ select           ",
    ]);
    // Check decorations are correctly set
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 4 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
          { line: i + 1, column: 39, length: 12 },
          { line: i + 1, column: 77, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 4 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
          { line: i + 1, column: 51, length: 5 },
          { line: i + 1, column: 89, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 4 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
          { line: i + 1, column: 56, length: 17 },
          { line: i + 1, column: 94, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });

  await t.step("2 page 1 column", async () => {
    const pages = await buildMappingHelpPages(denops, 50, 7);
    assertEquals(pages.length, 2);
    // Page 1
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-first       ",
      "       <C-G> ➙ list-last        ",
      "  <S-PageUp> ➙ list-left:scroll ",
      "    <PageUp> ➙ list-left        ",
      "       <C-D> ➙ list-next:scroll ",
      "       <C-N> ➙ list-next        ",
      "       <C-U> ➙ list-prev:scroll ",
    ]);
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    // Page 2
    assertEquals(pages[1].content, [
      "       <C-P> ➙ list-prev        ",
      "<S-PageDown> ➙ list-right:scroll",
      "  <PageDown> ➙ list-right       ",
      "       <C-.> ➙ select-all       ",
      "       <C-,> ➙ select           ",
    ]);
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });

  await t.step("2 page 1 column (ellipsis)", async () => {
    const pages = await buildMappingHelpPages(denops, 28, 7);
    assertEquals(pages.length, 2);
    // Page 1
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-fir…",
      "       <C-G> ➙ list-last",
      "  <S-PageUp> ➙ list-lef…",
      "    <PageUp> ➙ list-left",
      "       <C-D> ➙ list-nex…",
      "       <C-N> ➙ list-next",
      "       <C-U> ➙ list-pre…",
    ]);
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 7 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    // Page 2
    assertEquals(pages[1].content, [
      "       <C-P> ➙ list-prev",
      "<S-PageDown> ➙ list-rig…",
      "  <PageDown> ➙ list-rig…",
      "       <C-.> ➙ select-a…",
      "       <C-,> ➙ select   ",
    ]);
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 5 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });

  await t.step("2 page 2 column", async () => {
    const pages = await buildMappingHelpPages(denops, 80, 3);
    assertEquals(pages.length, 2);
    // Page 1
    assertEquals(pages[0].content, [
      "       <C-T> ➙ list-first               <PageUp> ➙ list-left        ",
      "       <C-G> ➙ list-last                   <C-D> ➙ list-next:scroll ",
      "  <S-PageUp> ➙ list-left:scroll            <C-N> ➙ list-next        ",
    ]);
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
          { line: i + 1, column: 39, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
          { line: i + 1, column: 51, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[0].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
          { line: i + 1, column: 56, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    // Page 2
    assertEquals(pages[1].content, [
      "       <C-U> ➙ list-prev:scroll       <PageDown> ➙ list-right       ",
      "       <C-P> ➙ list-prev                   <C-.> ➙ select-all       ",
      "<S-PageDown> ➙ list-right:scroll           <C-,> ➙ select           ",
    ]);
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingLhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 1, length: 12 },
          { line: i + 1, column: 39, length: 12 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingOperator")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 13, length: 5 },
          { line: i + 1, column: 51, length: 5 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
    assertEquals(
      pages[1].decorations!
        .filter((d) => d.highlight === "FallHelpMappingRhs")
        .map((d) => ({ line: d.line, column: d.column, length: d.length }))
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
      Array.from({ length: 3 })
        .map((_, i) => [
          { line: i + 1, column: 18, length: 17 },
          { line: i + 1, column: 56, length: 17 },
        ])
        .flat()
        .toSorted((a, b) => a.column - b.column)
        .toSorted((a, b) => a.line - b.line),
    );
  });
});
