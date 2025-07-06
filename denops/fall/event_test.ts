import { assertEquals } from "jsr:@std/assert@^1.0.6";

import { consume, dispatch, type Event } from "./event.ts";

Deno.test("Event", async (t) => {
  await t.step("consume consumes dispatched events", () => {
    dispatch({ type: "vim-cmdline-changed", cmdline: "echo 'hello'" });
    dispatch({ type: "vim-cmdpos-changed", cmdpos: 10 });

    let dispatchedEvents: Event[] = [];
    consume((event) => {
      dispatchedEvents.push(event);
    });

    assertEquals(dispatchedEvents, [
      { type: "vim-cmdline-changed", cmdline: "echo 'hello'" },
      { type: "vim-cmdpos-changed", cmdpos: 10 },
    ]);

    dispatchedEvents = [];
    consume((event) => {
      dispatchedEvents.push(event);
    });
    assertEquals(dispatchedEvents, []);
  });

  await t.step("multiple consumers receive all events in order", () => {
    dispatch({ type: "vim-cmdline-changed", cmdline: "test1" });
    dispatch({ type: "vim-cmdpos-changed", cmdpos: 5 });
    dispatch({ type: "vim-cmdline-changed", cmdline: "test2" });

    const results: Event[][] = [];
    consume((event) => {
      if (!results[0]) results[0] = [];
      results[0].push(event);
    });

    assertEquals(results[0], [
      { type: "vim-cmdline-changed", cmdline: "test1" },
      { type: "vim-cmdpos-changed", cmdpos: 5 },
      { type: "vim-cmdline-changed", cmdline: "test2" },
    ]);
  });

  await t.step("handles large number of events", () => {
    const eventCount = 10000;
    for (let i = 0; i < eventCount; i++) {
      dispatch({ type: "vim-cmdpos-changed", cmdpos: i });
    }

    let receivedCount = 0;
    consume((event) => {
      assertEquals(event.type, "vim-cmdpos-changed");
      receivedCount++;
    });

    assertEquals(receivedCount, eventCount);
  });

  await t.step("events are cleared after consume", () => {
    dispatch({ type: "vim-cmdline-changed", cmdline: "test" });

    let firstConsumeCount = 0;
    consume(() => {
      firstConsumeCount++;
    });
    assertEquals(firstConsumeCount, 1);

    let secondConsumeCount = 0;
    consume(() => {
      secondConsumeCount++;
    });
    assertEquals(secondConsumeCount, 0);
  });

  await t.step("handles events dispatched during consume", () => {
    dispatch({ type: "vim-cmdline-changed", cmdline: "initial" });

    const events: Event[] = [];
    consume((event) => {
      events.push(event);
      if (event.type === "vim-cmdline-changed" && event.cmdline === "initial") {
        // This dispatch happens during consume - should not be consumed in this cycle
        dispatch({ type: "vim-cmdpos-changed", cmdpos: 42 });
      }
    });

    assertEquals(events, [
      { type: "vim-cmdline-changed", cmdline: "initial" },
    ]);

    // The event dispatched during consume should be available in next consume
    const nextEvents: Event[] = [];
    consume((event) => {
      nextEvents.push(event);
    });

    assertEquals(nextEvents, [
      { type: "vim-cmdpos-changed", cmdpos: 42 },
    ]);
  });
});
