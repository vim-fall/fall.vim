import { assertEquals } from "@std/assert";
import { DenopsStub } from "@denops/test";

import { consume, type Event } from "../event.ts";
import { Cmdliner } from "./cmdliner.ts";

Deno.test("Cmdliner", async (t) => {
  await t.step(
    "check dispatch 'vim-cmdline-changed' event only when 'cmdline' has changed",
    async () => {
      const denops = new DenopsStub({
        useCallInBatch: true,
        // deno-lint-ignore require-await
        call: async (fn: string, ..._args: unknown[]) => {
          switch (fn) {
            case "mode":
              return "c";
            case "getcmdline":
              return "echo 'hello'";
            case "getcmdpos":
              return 0;
            default:
              throw new Error(`Unexpected call: ${fn}`);
          }
        },
      });
      const cmdliner = new Cmdliner();
      await cmdliner.check(denops);

      let dispatchedEvents: Event[] = [];
      consume((event) => {
        dispatchedEvents.push(event);
      });

      assertEquals(dispatchedEvents, [
        { type: "vim-cmdline-changed", cmdline: "echo 'hello'" },
      ]);

      await cmdliner.check(denops);
      dispatchedEvents = [];
      consume((event) => {
        dispatchedEvents.push(event);
      });
      assertEquals(dispatchedEvents, []);
    },
  );

  await t.step(
    "check dispatch 'vim-cmdpos-changed' event only when 'cmdpos' has changed",
    async () => {
      const denops = new DenopsStub({
        useCallInBatch: true,
        // deno-lint-ignore require-await
        call: async (fn: string, ..._args: unknown[]) => {
          switch (fn) {
            case "mode":
              return "c";
            case "getcmdline":
              return "echo 'hello'";
            case "getcmdpos":
              return 5;
            default:
              throw new Error(`Unexpected call: ${fn}`);
          }
        },
      });
      const cmdliner = new Cmdliner();
      await cmdliner.check(denops);

      let dispatchedEvents: Event[] = [];
      consume((event) => {
        dispatchedEvents.push(event);
      });

      assertEquals(dispatchedEvents, [
        { type: "vim-cmdline-changed", cmdline: "echo 'hello'" },
        { type: "vim-cmdpos-changed", cmdpos: 5 },
      ]);

      await cmdliner.check(denops);
      dispatchedEvents = [];
      consume((event) => {
        dispatchedEvents.push(event);
      });
      assertEquals(dispatchedEvents, []);
    },
  );

  await t.step(
    "check does nothing if not in event-line mode",
    async () => {
      const denops = new DenopsStub({
        useCallInBatch: true,
        // deno-lint-ignore require-await
        call: async (fn: string, ..._args: unknown[]) => {
          switch (fn) {
            case "mode":
              return "v"; // not in event-line mode
            case "getcmdline":
              return "echo 'hello'";
            case "getcmdpos":
              return 5;
            default:
              throw new Error(`Unexpected call: ${fn}`);
          }
        },
      });
      const cmdliner = new Cmdliner();
      await cmdliner.check(denops);

      const dispatchedEvents: Event[] = [];
      consume((event) => {
        dispatchedEvents.push(event);
      });

      assertEquals(dispatchedEvents, []);
    },
  );
});
