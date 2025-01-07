import { assertEquals } from "jsr:@std/assert@^1.0.6";
import { DenopsStub } from "jsr:@denops/test@^3.0.4/stub";

import { emitPickerEnterSystem, emitPickerLeaveSystem } from "./emitter.ts";

Deno.test("emitPickerEnterSystem", async (t) => {
  await t.step("emit 'User FallPickerEnterSystem:{name}'", async () => {
    const called: [string, Record<PropertyKey, unknown>][] = [];
    const denops = new DenopsStub({
      cmd(name, ctx): Promise<void> {
        called.push([name, ctx]);
        return Promise.resolve();
      },
    });
    await emitPickerEnterSystem(denops, "test");
    assertEquals(called, [
      ["do <nomodeline> User FallPickerEnterSystem:test", {}],
    ]);
  });
});

Deno.test("emitPickerLeaveSystem", async (t) => {
  await t.step("emit 'User FallPickerLeaveSystem:{name}'", async () => {
    const called: [string, Record<PropertyKey, unknown>][] = [];
    const denops = new DenopsStub({
      cmd(name, ctx): Promise<void> {
        called.push([name, ctx]);
        return Promise.resolve();
      },
    });
    await emitPickerLeaveSystem(denops, "test");
    assertEquals(called, [
      ["do <nomodeline> User FallPickerLeaveSystem:test", {}],
    ]);
  });
});
