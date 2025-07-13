import { assertEquals, assertThrows } from "@std/assert";
import { Chunker } from "./chunker.ts";

Deno.test("Chunker", async (t) => {
  await t.step("capacity must be positive", () => {
    assertThrows(
      () => new Chunker<number>(0),
      Error,
      "capacity must be positive",
    );
    assertThrows(
      () => new Chunker<number>(-1),
      Error,
      "capacity must be positive",
    );
  });

  await t.step("put save the item and increase the internal count", () => {
    const chunker = new Chunker<number>(3);
    assertEquals(chunker.count, 0);
    chunker.put(0);
    assertEquals(chunker.count, 1);
    chunker.put(1);
    assertEquals(chunker.count, 2);
    chunker.put(2);
    assertEquals(chunker.count, 3);
  });

  await t.step(
    "put returns false until the internal buffer become full",
    () => {
      const chunker = new Chunker<number>(3);
      assertEquals(chunker.put(0), false);
      assertEquals(chunker.put(1), false);
      assertEquals(chunker.put(2), true);
    },
  );

  await t.step(
    "put throws error when the internal buffer is already full",
    () => {
      const chunker = new Chunker<number>(3);
      chunker.put(0);
      chunker.put(1);
      chunker.put(2);
      assertThrows(() => chunker.put(3), Error, "Chunker is full");
    },
  );

  await t.step(
    "consume consumes the items and reset the internal count",
    () => {
      const chunker = new Chunker<number>(3);
      chunker.put(0);
      chunker.put(1);
      chunker.put(2);
      assertEquals(Array.from(chunker.consume()), [0, 1, 2]);
      assertEquals(chunker.count, 0);
    },
  );

  await t.step(
    "consume consumes the items and reset the internal count (before full)",
    () => {
      const chunker = new Chunker<number>(3);
      chunker.put(0);
      chunker.put(1);
      assertEquals(Array.from(chunker.consume()), [0, 1]);
      assertEquals(chunker.count, 0);
    },
  );
});
