import { assertEquals } from "@std/assert";
import { getByteLength } from "./stringutil.ts";

Deno.test("getByteLength", () => {
  assertEquals(getByteLength(""), 0);
  assertEquals(getByteLength("a"), 1);
  assertEquals(getByteLength("あ"), 3);
});
