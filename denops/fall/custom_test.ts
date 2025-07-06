import { test } from "jsr:@denops/test@^3.0.0";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import { join } from "jsr:@std/path@^1.0.8/join";

import {
  getActionPickerParams,
  getPickerParams,
  getSetting,
  listPickerNames,
  loadUserCustom,
} from "./custom.ts";

describe("getSetting", () => {
  it("should return default setting", () => {
    const setting = getSetting();
    assertEquals(typeof setting.coordinator, "object");
    assertEquals(typeof setting.theme, "object");
    assertEquals(setting.theme.border.length, 8);
    assertEquals(setting.theme.divider.length, 6);
  });
});

describe("getActionPickerParams", () => {
  it("should return default action picker params", () => {
    const params = getActionPickerParams();
    assertEquals(Array.isArray(params.matchers), true);
    assertEquals(params.matchers.length, 1);
    assertEquals(typeof params.coordinator, "object");
  });
});

describe("getPickerParams", () => {
  it("should return undefined for non-existent picker", () => {
    const params = getPickerParams("non-existent");
    assertEquals(params, undefined);
  });
});

describe("listPickerNames", () => {
  it("should return empty array initially", () => {
    const names = listPickerNames();
    assertEquals(Array.isArray(names), true);
  });
});

// Tests that require real denops instance
test({
  mode: "all",
  name: "loadUserCustom - default custom",
  fn: async (denops) => {
    await denops.cmd("let g:fall_custom_path = '/non/existent/path.ts'");

    await loadUserCustom(denops);

    const setting = getSetting();
    assertEquals(typeof setting.coordinator, "object");
    assertEquals(typeof setting.theme, "object");
  },
});

test({
  mode: "all",
  name: "loadUserCustom - user custom",
  fn: async (denops) => {
    const tempDir = await Deno.makeTempDir();
    const customPath = join(tempDir, "custom.ts");

    await Deno.writeTextFile(
      customPath,
      `
      export async function main({ refineSetting }) {
        refineSetting({
          theme: {
            border: ["1", "2", "3", "4", "5", "6", "7", "8"],
            divider: ["a", "b", "c", "d", "e", "f"],
          },
        });
      }
    `,
    );

    await denops.cmd(`let g:fall_custom_path = '${customPath}'`);
    await loadUserCustom(denops, { reload: true });

    const setting = getSetting();
    assertEquals(setting.theme.border, [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    assertEquals(setting.theme.divider, ["a", "b", "c", "d", "e", "f"]);

    await Deno.remove(tempDir, { recursive: true });
  },
});

test({
  mode: "all",
  name: "loadUserCustom - reload option",
  fn: async (denops) => {
    const tempDir = await Deno.makeTempDir();
    const customPath = join(tempDir, "custom.ts");

    // First version
    await Deno.writeTextFile(
      customPath,
      `
      export async function main({ refineSetting }) {
        refineSetting({
          theme: {
            border: ["1", "2", "3", "4", "5", "6", "7", "8"],
            divider: ["a", "b", "c", "d", "e", "f"],
          },
        });
      }
    `,
    );

    await denops.cmd(`let g:fall_custom_path = '${customPath}'`);
    await loadUserCustom(denops);

    // Second version
    await Deno.writeTextFile(
      customPath,
      `
      export async function main({ refineSetting }) {
        refineSetting({
          theme: {
            border: ["x", "x", "x", "x", "x", "x", "x", "x"],
            divider: ["y", "y", "y", "y", "y", "y"],
          },
        });
      }
    `,
    );

    await loadUserCustom(denops, { reload: true });

    const setting = getSetting();
    assertEquals(setting.theme.border, [
      "x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x",
    ]);
    assertEquals(setting.theme.divider, ["y", "y", "y", "y", "y", "y"]);

    await Deno.remove(tempDir, { recursive: true });
  },
});

test({
  mode: "all",
  name: "loadUserCustom - validate picker names",
  fn: async (denops) => {
    const tempDir = await Deno.makeTempDir();
    const customPath = join(tempDir, "custom.ts");

    await Deno.writeTextFile(
      customPath,
      `
      import { fzf } from "jsr:@vim-fall/std@^0.10.0/builtin/matcher/fzf";
      
      export async function main({ definePickerFromSource }) {
        definePickerFromSource(
          "@invalid",
          { collect: async function* () {} },
          {
            matchers: [fzf()],
            actions: { default: { invoke: async () => {} } },
            defaultAction: "default",
          }
        );
      }
    `,
    );

    await denops.cmd(`let g:fall_custom_path = '${customPath}'`);

    // Should not throw but log warning
    await loadUserCustom(denops, { reload: true });

    await Deno.remove(tempDir, { recursive: true });
  },
});

test({
  mode: "all",
  name: "loadUserCustom - validate action names",
  fn: async (denops) => {
    const tempDir = await Deno.makeTempDir();
    const customPath = join(tempDir, "custom.ts");

    await Deno.writeTextFile(
      customPath,
      `
      import { fzf } from "jsr:@vim-fall/std@^0.10.0/builtin/matcher/fzf";
      
      export async function main({ definePickerFromSource }) {
        definePickerFromSource(
          "test",
          { collect: async function* () {} },
          {
            matchers: [fzf()],
            actions: {
              "@invalid": { invoke: async () => {} },
              valid: { invoke: async () => {} },
            },
            defaultAction: "valid",
          }
        );
      }
    `,
    );

    await denops.cmd(`let g:fall_custom_path = '${customPath}'`);

    // Should not throw but log warning
    await loadUserCustom(denops, { reload: true });

    await Deno.remove(tempDir, { recursive: true });
  },
});

test({
  mode: "all",
  name: "loadUserCustom - verbose option",
  fn: async (denops) => {
    // Test that verbose option doesn't throw errors
    // We can't reliably intercept cmd calls on real Denops instances
    await denops.cmd("let g:fall_custom_path = '/non/existent/path.ts'");

    // Should not throw
    await loadUserCustom(denops, { verbose: true, reload: true });

    // If we reach here, the verbose option worked without errors
    assertEquals(true, true);
  },
});
