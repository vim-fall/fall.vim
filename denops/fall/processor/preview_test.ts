import "../lib/polyfill.ts";

import { assertEquals, assertThrows } from "@std/assert";
import { DenopsStub } from "@denops/test";
import { Notify } from "@core/asyncutil";
import { flushPromises } from "@core/asyncutil";
import { type DetailUnit, type IdItem, type Previewer } from "@vim-fall/core";
import { definePreviewer } from "@vim-fall/std";

import { dispose } from "../lib/dispose.ts";
import { PreviewProcessor } from "./preview.ts";
import { getDispatchedEvents } from "./_testutil.ts";

function defineDummyPreviewer(
  waiter?: () => Promise<void>,
  callback?: (item: IdItem<DetailUnit>) => void,
): Previewer {
  return definePreviewer(async function (_denops, { item }) {
    await waiter?.();
    callback?.(item);
    return {
      content: [item.value],
    };
  });
}

Deno.test("PreviewProcessor", async (t) => {
  const denops = new DenopsStub();
  const item = {
    id: 0,
    value: "dummy item",
    detail: {},
  };
  const expect = {
    content: ["dummy item"],
  };

  await t.step(
    "start dispatch 'preview-processor-started' event",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const previewer = defineDummyPreviewer();
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      assertEquals(getDispatchedEvents(), [
        {
          type: "preview-processor-started",
        },
      ]);
    },
  );

  await t.step(
    "start dispatch 'preview-processor-succeeded' once preview item is generated",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const previewer = defineDummyPreviewer(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      // Clear dispatched events
      getDispatchedEvents();

      notify.notify();
      await flushPromises();
      assertEquals(called, [0]);
      // Preview item is generated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "preview-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'preview-processor-failed' when filtering items failed",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const error = new Error("dummy error");
      const previewer = defineDummyPreviewer(
        () => {
          throw error;
        },
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      // Clear dispatched events
      getDispatchedEvents();

      await flushPromises();
      assertEquals(getDispatchedEvents(), [
        { type: "preview-processor-failed", err: error },
      ]);
    },
  );

  await t.step(
    "start generate preview item of the item and expose it",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const previewer = defineDummyPreviewer(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      assertEquals(called, []);
      assertEquals(processor.item, undefined);

      notify.notify();
      await flushPromises();

      assertEquals(called, [0]);
      assertEquals(processor.item, expect);
    },
  );

  await t.step(
    "start will invoke the last call if it is in progress",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const previewer = defineDummyPreviewer(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });
      processor.start(denops, { item: { ...item, id: 1 } });
      processor.start(denops, { item: { ...item, id: 2 } });
      processor.start(denops, { item: { ...item, id: 3 } });

      assertEquals(called, []);

      notify.notify();
      await flushPromises();

      assertEquals(called, [0]);

      notify.notify();
      await flushPromises();

      assertEquals(called, [0, 3]);
    },
  );

  await t.step(
    "dispose stops generating preview item",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const previewer = defineDummyPreviewer(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // The previewer is called but update should not be applied
      assertEquals(called, [0]);
      assertEquals(processor.item, undefined);
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
      const notify = new Notify();
      const called: unknown[] = [];
      const previewer = defineDummyPreviewer(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new PreviewProcessor([previewer]),
      );
      processor.start(denops, { item });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // Start after dispose should throw an error
      assertThrows(
        () => processor.start(denops, { item }),
        Error,
        "The processor is already disposed",
      );
    },
  );
});
