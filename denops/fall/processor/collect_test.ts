import "../lib/polyfill.ts";

import { assertEquals, assertThrows } from "@std/assert";
import { DenopsStub } from "@denops/test";
import { Notify } from "@core/asyncutil";
import { flushPromises } from "@core/asyncutil";
import type { Source } from "@vim-fall/core";
import { defineSource } from "@vim-fall/std";

import { dispose } from "../lib/dispose.ts";
import { CollectProcessor } from "./collect.ts";
import { getDispatchedEvents } from "./_testutil.ts";

function defineDummySource(
  waiter?: () => Promise<void>,
  callback?: (id: number) => void,
): Source<{ args: readonly string[] }> {
  return defineSource(async function* (_denops, { args }) {
    for (let id = 0; id < 5; id++) {
      await waiter?.();
      yield {
        id,
        value: id.toString(),
        detail: { args },
      };
      callback?.(id);
    }
  });
}

Deno.test("CollectProcessor", async (t) => {
  const denops = new DenopsStub();
  const never = new Promise<never>(() => {});
  const expect = [
    {
      detail: { args: ["args"] },
      id: 0,
      value: "0",
    },
    {
      detail: { args: ["args"] },
      id: 1,
      value: "1",
    },
    {
      detail: { args: ["args"] },
      id: 2,
      value: "2",
    },
    {
      detail: { args: ["args"] },
      id: 3,
      value: "3",
    },
    {
      detail: { args: ["args"] },
      id: 4,
      value: "4",
    },
  ] as const;

  await t.step(
    "start dispatch 'collect-processor-started' event",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const source = defineDummySource(() => never);
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      assertEquals(getDispatchedEvents(), [
        {
          type: "collect-processor-started",
        },
      ]);
    },
  );

  await t.step(
    "start dispatch 'collect-processor-updated/succeeded' by item collection status",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const source = defineDummySource(() => notify.notified());
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });
      getDispatchedEvents();

      notify.notify();
      await flushPromises();
      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises();
      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises();
      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "collect-processor-updated" },
      ]);

      notify.notify();
      await flushPromises();
      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises();
      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "collect-processor-updated" },
        { type: "collect-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'collect-processor-failed' when collecting items failed",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const error = new Error("dummy error");
      const source = defineDummySource(() => {
        throw error;
      });
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // Clear dispatched events
      getDispatchedEvents();

      await flushPromises();
      assertEquals(getDispatchedEvents(), [
        { type: "collect-processor-failed", err: error },
      ]);
    },
  );

  await t.step(
    "start gradually collect items from the source and expose them by chunks",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // Nothing is collected yet
      assertEquals(called, []);
      assertEquals(processor.items, []);

      // Chunk size is 3, so we need to notify 3 times to collect the first chunk
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Additional notify to make sure that the collected items are by chunks
      notify.notify();
      await flushPromises();

      // Four items are collected but only the first three items are exposed
      assertEquals(called, [0, 1, 2, 3]);
      assertEquals(processor.items, expect.slice(0, 3));

      // Additional notify to make sure that the collected items are by chunks
      notify.notify();
      await flushPromises();

      // All items are collected and all items are exposed
      assertEquals(called, [0, 1, 2, 3, 4]);
      assertEquals(processor.items, expect.slice());
    },
  );

  await t.step(
    "pause stops collecting items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // Notify four times here
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Pause the processor
      processor.pause();

      // Notify once more
      notify.notify();
      await flushPromises();

      // Four items are collected but only the first three items are exposed
      assertEquals(called, [0, 1, 2, 3]);
      assertEquals(processor.items, expect.slice(0, 3));
    },
  );

  await t.step(
    "start after pause continues collecting items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // Notify four times here
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Pause the processor
      processor.pause();

      // Notify once more
      notify.notify();
      await flushPromises();

      // Start again
      processor.start(denops, { args: ["args"] });

      // Only the first chunk is collected because the prior notify didn't affect
      assertEquals(called, [0, 1, 2, 3]);
      assertEquals(processor.items, expect.slice(0, 3));

      // Notify once more again
      notify.notify();
      await flushPromises();

      // Everything should be collected
      assertEquals(called, [0, 1, 2, 3, 4]);
      assertEquals(processor.items, expect.slice());
    },
  );

  await t.step(
    "dispose stops collecting items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Notify four times here
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Dispose the processor
      await dispose(processor);

      // Notify once more
      notify.notify();
      await flushPromises();

      // Only the first four notify should be invoked
      assertEquals(called, [0, 1, 2, 3]);
      assertEquals(processor.items, expect.slice(0, 3));
    },
  );

  await t.step(
    "start after dispose throws an error",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Notify four times here
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Dispose the processor
      await dispose(processor);

      // Notify once more
      notify.notify();
      await flushPromises();

      // Only the first four notify should be invoked
      assertEquals(called, [0, 1, 2, 3]);

      // Start after dispose should throw an error
      assertThrows(
        () => processor.start(denops, { args: ["args"] }),
        Error,
        "The processor is already disposed",
      );
    },
  );

  await t.step(
    "pause after dispose throws an error",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const called: number[] = [];
      const notify = new Notify();
      const source = defineDummySource(
        () => notify.notified(),
        (id) => called.push(id),
      );
      const processor = stack.use(
        new CollectProcessor(source, {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { args: ["args"] });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Notify four times here
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Dispose the processor
      await dispose(processor);

      // Notify once more
      notify.notify();
      await flushPromises();

      // Only the first four notify should be invoked
      assertEquals(called, [0, 1, 2, 3]);

      // Start after dispose should throw an error
      assertThrows(
        () => processor.pause(),
        Error,
        "The processor is already disposed",
      );
    },
  );
});
