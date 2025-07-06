import "../lib/polyfill.ts";

import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.7";
import { DenopsStub } from "jsr:@denops/test@^3.0.4";
import { Notify } from "jsr:@core/asyncutil@^1.2.0";
import { flushPromises } from "jsr:@core/asyncutil@^1.2.0";
import {
  type DetailUnit,
  type IdItem,
  type Sorter,
} from "jsr:@vim-fall/core@^0.3.0";
import { defineSorter } from "jsr:@vim-fall/std@^0.10.0";

import { dispose } from "../lib/dispose.ts";
import { SortProcessor } from "./sort.ts";
import { getDispatchedEvents } from "./_testutil.ts";

function defineDummySorter(
  waiter?: () => Promise<void>,
  callback?: (items: IdItem<DetailUnit>[]) => void,
): Sorter {
  return defineSorter(async function (_denops, { items }) {
    await waiter?.();
    callback?.(items);
    items.sort((a, b) => (b.id as number) - (a.id as number));
  });
}

Deno.test("SortProcessor", async (t) => {
  const denops = new DenopsStub();
  const items = Array.from({ length: 3 }, (_, id) => ({
    id: id,
    value: id.toString(),
    detail: {},
  }));

  await t.step(
    "start dispatch 'sort-processor-started' event",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const sorter = defineDummySorter();
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });

      assertEquals(getDispatchedEvents(), [
        {
          type: "sort-processor-started",
        },
      ]);
    },
  );

  await t.step(
    "start dispatch 'sort-processor-succeeded' once sorting is done",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const sorter = defineDummySorter(
        () => notify.notified(),
      );
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });

      // Clear dispatched events
      getDispatchedEvents();

      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      assertEquals(getDispatchedEvents(), [
        { type: "sort-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'sort-processor-failed' when sorting has failed",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const error = new Error("dummy error");
      const sorter = defineDummySorter(
        () => {
          throw error;
        },
      );
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });

      // Clear dispatched events
      getDispatchedEvents();

      await flushPromises();
      assertEquals(getDispatchedEvents(), [
        { type: "sort-processor-failed", err: error },
      ]);
    },
  );

  await t.step(
    "start sorts items without modifying original array (copy-on-write)",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const sorter = defineDummySorter();
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      const original = items.slice();
      processor.start(denops, { items: original });

      // Original array should not be modified
      assertEquals(original, [
        { id: 0, value: "0", detail: {} },
        { id: 1, value: "1", detail: {} },
        { id: 2, value: "2", detail: {} },
      ]);

      notify.notify();
      await flushPromises();

      // Original array should still not be modified
      assertEquals(original, [
        { id: 0, value: "0", detail: {} },
        { id: 1, value: "1", detail: {} },
        { id: 2, value: "2", detail: {} },
      ]);

      // Processor should have sorted items
      assertEquals(processor.items, [
        { id: 2, value: "2", detail: {} },
        { id: 1, value: "1", detail: {} },
        { id: 0, value: "0", detail: {} },
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
      const sorter = defineDummySorter(
        () => notify.notified(),
        (items) => called.push(items.map((v) => v.id)),
      );
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });
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
    "dispose stops sorting items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const sorter = defineDummySorter(
        () => notify.notified(),
        (items) => called.push(items.map((v) => v.id)),
      );
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // The sorter is called but update should not be applied
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
      const sorter = defineDummySorter(() => notify.notified());
      const processor = stack.use(
        new SortProcessor([sorter]),
      );
      processor.start(denops, { items: items.slice() });

      // Dispose the processor
      dispose(processor);

      notify.notify();
      await flushPromises();

      // Start after dispose should throw an error
      assertThrows(
        () => processor.start(denops, { items: items.slice() }),
        Error,
        "The processor is already disposed",
      );
    },
  );
});
