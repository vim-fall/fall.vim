import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { UniqueOrderedList } from "./unique_ordered_list.ts";

type User = { id: number; name: string };

Deno.test("UniqueOrderedList: push unique items", () => {
  const list = new UniqueOrderedList<User>([], {
    identifier: (user) => user.id,
  });
  list.push({ id: 1, name: "Alice" });
  list.push({ id: 2, name: "Bob" });

  assertEquals(list.size, 2);
  assertEquals(list.items, [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

Deno.test("UniqueOrderedList: skip duplicate items", () => {
  const list = new UniqueOrderedList<User>([], {
    identifier: (user) => user.id,
  });
  list.push({ id: 1, name: "Alice" });
  list.push({ id: 1, name: "Alice (dup)" }); // 重複
  list.push({ id: 2, name: "Bob" });

  assertEquals(list.size, 2);
  assertEquals(list.items, [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

Deno.test("UniqueOrderedList: order is preserved", () => {
  const list = new UniqueOrderedList<number>();
  list.push(3, 1, 4, 1, 5, 9, 2, 6, 5); // 重複あり

  assertEquals(list.items, [3, 1, 4, 5, 9, 2, 6]);
});

Deno.test("UniqueOrderedList: accepts string keys", () => {
  const list = new UniqueOrderedList<{ key: string }>([], {
    identifier: (item) => item.key,
  });
  list.push({ key: "a" });
  list.push({ key: "b" });
  list.push({ key: "a" });

  assertEquals(list.size, 2);
  assertEquals(list.items.map((i) => i.key), ["a", "b"]);
});

Deno.test("UniqueOrderedList: initializes with items", () => {
  const initialItems = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 1, name: "Alice (dup)" }, // Duplicate id
  ];
  const list = new UniqueOrderedList<User>(initialItems, {
    identifier: (user) => user.id,
  });

  // Only unique items are kept from initialization
  assertEquals(list.size, 2);
  assertEquals(list.items, [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);

  // Pushing duplicate IDs is properly prevented
  list.push({ id: 1, name: "Alice (another dup)" });
  assertEquals(list.size, 2); // Still 2, duplicate was ignored
});

Deno.test("UniqueOrderedList: works without identifier function", () => {
  const list = new UniqueOrderedList<number>([1, 2, 3, 2, 1]); // Has duplicates

  // Initial duplicates are filtered
  assertEquals(list.size, 3);
  assertEquals(list.items, [1, 2, 3]);

  list.push(4, 2, 5); // 2 is duplicate and will be ignored
  assertEquals(list.size, 5);
  assertEquals(list.items, [1, 2, 3, 4, 5]);
});
