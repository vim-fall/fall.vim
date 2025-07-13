import { assertEquals } from "@std/assert";
import { dispose } from "./dispose.ts";

Deno.test("dispose", async (t) => {
  await t.step("invoke [Symbol.dispose] method", async () => {
    const obj = {
      disposed: false,
      [Symbol.dispose]() {
        this.disposed = true;
      },
    };
    assertEquals(obj.disposed, false);
    await dispose(obj);
    assertEquals(obj.disposed, true);
  });

  await t.step("invoke [Symbol.asyncDispose] method", async () => {
    const obj = {
      disposed: false,
      [Symbol.asyncDispose]() {
        this.disposed = true;
        return Promise.resolve();
      },
    };
    assertEquals(obj.disposed, false);
    await dispose(obj);
    assertEquals(obj.disposed, true);
  });

  await t.step(
    "invoke [Symbol.dispose] method and [Symbol.asyncDispose] method",
    async () => {
      const obj = {
        disposed: 0,
        [Symbol.dispose]() {
          this.disposed += 1;
        },
        [Symbol.asyncDispose]() {
          this.disposed += 1;
          return Promise.resolve();
        },
      };
      assertEquals(obj.disposed, 0);
      await dispose(obj);
      assertEquals(obj.disposed, 2);
    },
  );

  await t.step("does nothing if resource is not disposable", async () => {
    const obj = {};
    await dispose(obj);
  });
});
