import { assertEquals } from "jsr:@std/assert@^1.0.8";
import { ItemBelt } from "./item_belt.ts";

Deno.test("ItemBelt", async (t) => {
  await t.step("current returns `undefined` when `items` is empty", () => {
    const belt = new ItemBelt([]);
    assertEquals(belt.current, undefined);
  });

  await t.step("index returns 0 when `items` is empty", () => {
    const belt = new ItemBelt([]);
    assertEquals(belt.index, 0);
  });

  await t.step("count returns 0 when `items` is empty", () => {
    const belt = new ItemBelt([]);
    assertEquals(belt.count, 0);
  });

  await t.step("current returns the first item in default", () => {
    const belt = new ItemBelt([0, 1, 2]);
    assertEquals(belt.current, 0);
  });

  await t.step("index returns 0 in default", () => {
    const belt = new ItemBelt([0, 1, 2]);
    assertEquals(belt.index, 0);
  });

  await t.step("count returns the number of items", () => {
    const belt = new ItemBelt([0, 1, 2]);
    assertEquals(belt.count, 3);
  });

  await t.step("constructor accepts initial index option", () => {
    const belt = new ItemBelt([0, 1, 2], { index: 1 });
    assertEquals(belt.index, 1);
    assertEquals(belt.current, 1);
  });

  await t.step("constructor clamps initial index when too large", () => {
    const belt = new ItemBelt([0, 1, 2], { index: 5 });
    assertEquals(belt.index, 2);
    assertEquals(belt.current, 2);
  });

  await t.step("constructor clamps initial index when negative", () => {
    const belt = new ItemBelt([0, 1, 2], { index: -1 });
    assertEquals(belt.index, 0);
    assertEquals(belt.current, 0);
  });

  await t.step("changing index changes current", () => {
    const belt = new ItemBelt([0, 1, 2]);
    belt.index = 1;
    assertEquals(belt.current, 1);
  });

  await t.step("changing index to -1 select the first item", () => {
    const belt = new ItemBelt([0, 1, 2]);
    belt.index = -1;
    assertEquals(belt.index, 0);
  });

  await t.step(
    "changing index to larger than the items count select the last item",
    () => {
      const belt = new ItemBelt([0, 1, 2]);
      belt.index = 3;
      assertEquals(belt.index, 2);
    },
  );

  await t.step(
    "changing items regulates index larger than the items count",
    () => {
      const belt = new ItemBelt([0, 1, 2]);
      belt.index = 2;
      belt.items = [3, 4];
      assertEquals(belt.index, 1);
    },
  );

  await t.step(
    "select changes index by the offset",
    () => {
      const belt = new ItemBelt([0, 1, 2, 3, 4]);
      belt.select();
      assertEquals(belt.index, 1);

      belt.select(1);
      assertEquals(belt.index, 2);

      belt.select(-1);
      assertEquals(belt.index, 1);

      belt.select(2);
      assertEquals(belt.index, 3);

      belt.select(-2);
      assertEquals(belt.index, 1);
    },
  );

  await t.step(
    "select changes index with large offset when cycle is false",
    () => {
      const belt = new ItemBelt([0, 1, 2, 3, 4]);
      belt.select(8);
      assertEquals(belt.index, 4);

      belt.select(-8);
      assertEquals(belt.index, 0);
    },
  );

  await t.step(
    "select changes index with large offset when cycle is true",
    () => {
      const belt = new ItemBelt([0, 1, 2, 3, 4]);
      belt.select(8, { cycle: true });
      assertEquals(belt.index, 3);

      belt.select(-7, { cycle: true });
      assertEquals(belt.index, 1);
    },
  );
});
