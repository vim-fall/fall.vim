import { delay } from "@std/async";
import { assertEquals } from "@std/assert";
import { Scheduler } from "./scheduler.ts";

Deno.test("Scheduler", async (t) => {
  await t.step(
    "calls the given asynchronous callback function with the given interval without overlapping",
    async () => {
      let count = 0;
      let locked = false;
      {
        using scheduler = new Scheduler(100);
        scheduler.start(async () => {
          if (locked) {
            throw new Error("Overlapping");
          }
          locked = true;
          await delay(100);
          count++;
          locked = false;
        });
        await delay(950);
      }
      // ```
      // Count             1                   2                   3                   4
      // -------->=========|--------->=========|--------->=========|--------->=========|--------->====x
      // Time    100       200       300       400       500       600       700       800       900
      // ```
      assertEquals(count, 4);
    },
  );

  await t.step(
    "stops when the callback throws an error",
    async () => {
      let count = 0;
      {
        using scheduler = new Scheduler(100);
        scheduler.start(() => {
          count++;
          throw new Error("Error");
        }).catch(() => {});
        await delay(500);
      }
      // ```
      // Count   1
      // --------x........................................
      // Time    100       200       300       400       500
      // ```
      assertEquals(count, 1);
    },
  );

  await t.step(
    "does not call the given asynchronous callback function if the signal is already aborted",
    async () => {
      const controller = new AbortController();
      const { signal } = controller;
      controller.abort();
      let count = 0;
      {
        using scheduler = new Scheduler(100);
        scheduler.start(() => {
          count++;
          return Promise.resolve();
        }, { signal });
        await delay(200);
      }
      // ```
      // Count
      // ...................
      // Time    100       200
      // ```
      assertEquals(count, 0);
    },
  );

  await t.step(
    "does not call the given asynchronous callback function after the signal is aborted",
    async () => {
      const controller = new AbortController();
      const { signal } = controller;
      let count = 0;
      {
        using scheduler = new Scheduler(100);
        scheduler.start(() => {
          count++;
          return Promise.resolve();
        }, { signal });
        await delay(250);
        controller.abort();
        await delay(250);
      }
      // ```
      // Count   1         2
      // --------|---------|----x.........................
      // Time    100       200       300       400       500
      // ```
      assertEquals(count, 2);
    },
  );
});
