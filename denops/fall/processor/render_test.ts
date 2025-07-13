import "../lib/polyfill.ts";

import { assertEquals, assertThrows } from "@std/assert";
import { DenopsStub } from "@denops/test";
import { Notify } from "@core/asyncutil";
import { flushPromises } from "@core/asyncutil";
import {
  type DetailUnit,
  type DisplayItem,
  type Renderer,
} from "@vim-fall/core";
import { defineRenderer } from "@vim-fall/std";

import { dispose } from "../lib/dispose.ts";
import { RenderProcessor } from "./render.ts";
import { getDispatchedEvents } from "./_testutil.ts";

function defineDummyRenderer(
  waiter?: () => Promise<void>,
  callback?: (items: DisplayItem<DetailUnit>[]) => void,
): Renderer {
  return defineRenderer(async function (_denops, { items }) {
    await waiter?.();
    callback?.(items);
    items.forEach((item) => {
      item.label = `Rendered ${item.value}`;
    });
  });
}

Deno.test("RenderProcessor", async (t) => {
  const denops = new DenopsStub();
  const items = Array.from({ length: 3 }, (_, id) => ({
    id: id,
    value: id.toString(),
    detail: {},
  }));

  await t.step(
    "start dispatch 'render-processor-started' event",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const renderer = defineDummyRenderer();
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items: items.slice() });

      assertEquals(getDispatchedEvents(), [
        {
          type: "render-processor-started",
        },
      ]);
    },
  );

  await t.step(
    "start dispatch 'render-processor-succeeded' once rendering is done",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const renderer = defineDummyRenderer(
        () => notify.notified(),
      );
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });

      // Clear dispatched events
      getDispatchedEvents();

      notify.notify();
      await flushPromises();

      assertEquals(getDispatchedEvents(), [
        { type: "render-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'render-processor-failed' when rendering has failed",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const error = new Error("dummy error");
      const renderer = defineDummyRenderer(
        () => {
          throw error;
        },
      );
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });

      // Clear dispatched events
      getDispatchedEvents();

      await flushPromises();
      assertEquals(getDispatchedEvents(), [
        { type: "render-processor-failed", err: error },
      ]);
    },
  );

  await t.step(
    "start render items and expose them",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const renderer = defineDummyRenderer();
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });

      assertEquals(processor.items, []);

      notify.notify();
      await flushPromises();

      assertEquals(processor.items, [
        { id: 0, value: "0", label: "Rendered 0", detail: {}, decorations: [] },
        { id: 1, value: "1", label: "Rendered 1", detail: {}, decorations: [] },
        { id: 2, value: "2", label: "Rendered 2", detail: {}, decorations: [] },
      ]);
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
      const renderer = defineDummyRenderer(
        () => notify.notified(),
        (items) => called.push(items.map((v) => v.id)),
      );
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });
      processor.start(denops, {
        items: items.map((v) => ({ ...v, id: 1 + v.id })),
      });
      processor.start(denops, {
        items: items.map((v) => ({ ...v, id: 2 + v.id })),
      });
      processor.start(denops, {
        items: items.map((v) => ({ ...v, id: 3 + v.id })),
      });

      assertEquals(called, []);

      notify.notify();
      await flushPromises();
      assertEquals(called, [[0, 1, 2]]);

      notify.notify();
      await flushPromises();
      assertEquals(called, [[0, 1, 2], [3, 4, 5]]);
    },
  );

  await t.step(
    "dispose stops rendering items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const renderer = defineDummyRenderer(
        () => notify.notified(),
        (items) => called.push(items.map((v) => v.id)),
      );
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // The renderer is called but update should not be applied
      assertEquals(called, [[0, 1, 2]]);
      assertEquals(processor.items, []);
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
      const renderer = defineDummyRenderer(
        () => notify.notified(),
      );
      const processor = stack.use(
        new RenderProcessor([renderer]),
      );
      processor.start(denops, { items });

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // Start after dispose should throw an error
      assertThrows(
        () => processor.start(denops, { items }),
        Error,
        "The processor is already disposed",
      );
    },
  );
});
