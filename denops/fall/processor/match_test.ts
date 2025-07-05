import "../lib/polyfill.ts";

import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.7";
import { DenopsStub } from "jsr:@denops/test@^3.0.4";
import { Notify } from "jsr:@core/asyncutil@^1.2.0";
import { flushPromises } from "jsr:@core/asyncutil@^1.2.0";
import {
  type DetailUnit,
  type IdItem,
  type Matcher,
} from "jsr:@vim-fall/core@^0.3.0";
import { defineMatcher } from "jsr:@vim-fall/std@^0.10.0";

import { dispose } from "../lib/dispose.ts";
import { MatchProcessor } from "./match.ts";
import { getDispatchedEvents } from "./_testutil.ts";

function defineDummyMatcher(
  waiter?: () => Promise<void>,
  callback?: (item: IdItem<DetailUnit>) => void,
): Matcher {
  return defineMatcher(async function* (_denops, { items, query }) {
    for (const item of items) {
      await waiter?.();
      if (item.value.includes(query)) {
        yield item;
      }
      callback?.(item);
    }
  });
}

Deno.test("MatchProcessor", async (t) => {
  const denops = new DenopsStub();
  const items = Array.from({ length: 10 }, (_, id) => ({
    id,
    value: `${id % 2 === 0 ? "even" : "odd"}-${id}`,
    detail: {},
  }));
  const expect = items.filter(({ value }) => value.includes("even"));

  await t.step(
    "start dispatch 'match-processor-started' event",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const matcher = defineDummyMatcher();
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "" });

      assertEquals(getDispatchedEvents(), [
        {
          type: "match-processor-started",
        },
      ]);
    },
  );

  await t.step(
    "start dispatch 'match-processor-succeeded' by item filtration status in non incremental mode",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // Clear dispatched events
      getDispatchedEvents();

      notify.notify();
      await flushPromises(); // 0
      assertEquals(called, [0]);

      notify.notify();
      await flushPromises(); // 1 -> Drop
      assertEquals(called, [0, 1]);

      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 2
      assertEquals(called, [0, 1, 2]);

      notify.notify();
      await flushPromises(); // 3 -> Drop
      assertEquals(called, [0, 1, 2, 3]);

      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 4
      await flushPromises(); // delay for interval
      assertEquals(called, [0, 1, 2, 3, 4]);

      notify.notify();
      await flushPromises(); // 5 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5]);

      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 6
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6]);
      notify.notify();
      await flushPromises(); // 7 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7]);
      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 8
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      notify.notify();
      await flushPromises(); // 9 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "match-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'match-processor-updated/succeeded' by item filtration status in incremental mode",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
          incremental: true,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // Clear dispatched events
      getDispatchedEvents();

      notify.notify();
      await flushPromises(); // 0
      assertEquals(called, [0]);

      notify.notify();
      await flushPromises(); // 1 -> Drop
      assertEquals(called, [0, 1]);

      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 2
      assertEquals(called, [0, 1, 2]);

      notify.notify();
      await flushPromises(); // 3 -> Drop
      assertEquals(called, [0, 1, 2, 3]);

      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 4
      await flushPromises(); // delay for interval
      assertEquals(called, [0, 1, 2, 3, 4]);

      notify.notify();
      await flushPromises(); // 5 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5]);

      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "match-processor-updated" },
      ]);

      notify.notify();
      await flushPromises(); // 6
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6]);
      notify.notify();
      await flushPromises(); // 7 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7]);
      // Chunk is not updated yet so the event should not be dispatched
      assertEquals(getDispatchedEvents(), []);

      notify.notify();
      await flushPromises(); // 8
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      notify.notify();
      await flushPromises(); // 9 -> Drop
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Chunk is updated so the event should be dispatched
      assertEquals(getDispatchedEvents(), [
        { type: "match-processor-updated" },
        { type: "match-processor-succeeded" },
      ]);
    },
  );

  await t.step(
    "start dispatch 'match-processor-failed' when filtering items failed",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const error = new Error("dummy error");
      const matcher = defineDummyMatcher(
        () => {
          throw error;
        },
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // Clear dispatched events
      getDispatchedEvents();

      await flushPromises();
      assertEquals(getDispatchedEvents(), [
        { type: "match-processor-failed", err: error },
      ]);
    },
  );

  await t.step(
    "start filter items from the items and expose them at once in non incremental mode",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // Nothing is filtered yet
      assertEquals(called, []);
      assertEquals(processor.items, []);

      // Chunk size is 3, so we need to notify 6 times to filter the first chunk
      for (let i = 0; i < 6; i++) {
        notify.notify();
        await flushPromises();
      }

      // Additional notify to make sure that the filtered items are by chunks
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Four items are filtered but no items are exposed
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6]);
      assertEquals(processor.items, []);

      // Additional notify to make sure that the filtered items are by chunks
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // All items are filtered and all items are exposed
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assertEquals(processor.items, expect.slice());
    },
  );

  await t.step(
    "start gradually filter items from the items and expose them by chunks in incremental mode",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
          incremental: true,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // Nothing is filtered yet
      assertEquals(called, []);
      assertEquals(processor.items, []);

      // Chunk size is 3, so we need to notify 6 times to filter the first chunk
      for (let i = 0; i < 6; i++) {
        notify.notify();
        await flushPromises();
      }

      // Additional notify to make sure that the filtered items are by chunks
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // Four items are filtered but only the first three items are exposed
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6]);
      assertEquals(processor.items, expect.slice(0, 3));

      // Additional notify to make sure that the filtered items are by chunks
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();
      notify.notify();
      await flushPromises();

      // All items are filtered and all items are exposed
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assertEquals(processor.items, expect.slice());
    },
  );

  await t.step(
    "start will invoke latest call if it is in progress",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, {
        items: [{ id: 0, value: "0", detail: {} }],
        query: "q0",
      });
      processor.start(denops, {
        items: [{ id: 1, value: "1", detail: {} }],
        query: "q1",
      });
      processor.start(denops, {
        items: [{ id: 2, value: "2", detail: {} }],
        query: "q2",
      });
      processor.start(denops, {
        items: [{ id: 3, value: "3", detail: {} }],
        query: "q3",
      });

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
    "start will abort the in-progress call and invoke the latest call if 'restart' is specified and it is in progress",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, {
        items: [{ id: 0, value: "0", detail: {} }],
        query: "q0",
      }, { restart: true });
      processor.start(denops, {
        items: [{ id: 1, value: "1", detail: {} }],
        query: "q1",
      }, { restart: true });
      processor.start(denops, {
        items: [{ id: 2, value: "2", detail: {} }],
        query: "q2",
      }, { restart: true });
      processor.start(denops, {
        items: [{ id: 3, value: "3", detail: {} }],
        query: "q3",
      }, { restart: true });

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
    "dispose stops filtering items",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Notify eight times here
      for (let i = 0; i < 8; i++) {
        notify.notify();
        await flushPromises();
      }

      // Dispose the processor
      await dispose(processor);

      // Notify two times here
      for (let i = 0; i < 2; i++) {
        notify.notify();
        await flushPromises();
      }

      // Only the first eight notify should be invoked
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7]);
      assertEquals(processor.items, []);
    },
  );

  await t.step(
    "dispose stops filtering items (incremental)",
    async () => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // Clear dispatched events
        await flushPromises();
        getDispatchedEvents();
      });
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
          incremental: true,
        }),
      );
      processor.start(denops, { items, query: "even" });

      // The internal iteration should not be started yet.
      assertEquals(called, []);

      // Notify eight times here
      for (let i = 0; i < 8; i++) {
        notify.notify();
        await flushPromises();
      }

      // Dispose the processor
      await dispose(processor);

      // Notify two times here
      for (let i = 0; i < 2; i++) {
        notify.notify();
        await flushPromises();
      }

      // Only the first eight notify should be invoked
      assertEquals(called, [0, 1, 2, 3, 4, 5, 6, 7]);
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
      const notify = new Notify();
      const called: unknown[] = [];
      const matcher = defineDummyMatcher(
        () => notify.notified(),
        ({ id }) => called.push(id),
      );
      const processor = stack.use(
        new MatchProcessor([matcher], {
          chunkSize: 3,
        }),
      );
      processor.start(denops, { items, query: "even" });

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
        () => processor.start(denops, { items, query: "even" }),
        Error,
        "The processor is already disposed",
      );
    },
  );
});
