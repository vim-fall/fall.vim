import { assertEquals } from "jsr:@std/assert@^1.0.6";
import { delay } from "jsr:@std/async@^1.0.0/delay";
import { FakeTime } from "jsr:@std/testing@^1.0.0/time";

import { debounce } from "./debounce.ts";

Deno.test("debounce", async (t) => {
  await t.step("delays function execution", async () => {
    using time = new FakeTime();

    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, { delay: 100 });

    fn();
    assertEquals(callCount, 0);

    await time.tickAsync(50);
    assertEquals(callCount, 0);

    await time.tickAsync(50);
    assertEquals(callCount, 1);
  });

  await t.step(
    "cancels previous calls when called multiple times",
    async () => {
      using time = new FakeTime();

      let callCount = 0;
      let lastValue = 0;
      const fn = debounce((value: number) => {
        callCount++;
        lastValue = value;
      }, { delay: 100 });

      fn(1);
      await time.tickAsync(50);
      fn(2);
      await time.tickAsync(50);
      fn(3);
      await time.tickAsync(50);

      assertEquals(callCount, 0);

      await time.tickAsync(50);
      assertEquals(callCount, 1);
      assertEquals(lastValue, 3);
    },
  );

  await t.step("works with real timers", async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, { delay: 50 });

    fn();
    assertEquals(callCount, 0);

    await delay(30);
    assertEquals(callCount, 0);

    await delay(30);
    assertEquals(callCount, 1);
  });

  await t.step("respects abort signal", async () => {
    using time = new FakeTime();

    let callCount = 0;
    const controller = new AbortController();
    const fn = debounce(() => {
      callCount++;
    }, { delay: 100, signal: controller.signal });

    fn();
    await time.tickAsync(50);

    controller.abort();

    await time.tickAsync(100);
    assertEquals(callCount, 0);
  });
});
