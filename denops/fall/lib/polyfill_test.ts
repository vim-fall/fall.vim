import { assertEquals, assertInstanceOf } from "jsr:@std/assert@^1.0.0";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";

import "./polyfill.ts";

describe("polyfill", () => {
  it("should provide DisposableStack in globalThis", () => {
    // deno-lint-ignore no-explicit-any
    const stack = new (globalThis as any).DisposableStack();
    assertInstanceOf(stack, Object);
    assertEquals(typeof stack.dispose, "function");
    assertEquals(typeof stack.use, "function");
    assertEquals(typeof stack.adopt, "function");
    assertEquals(typeof stack.defer, "function");
    assertEquals(typeof stack.move, "function");

    // Clean up
    stack.dispose();
  });

  it("should provide AsyncDisposableStack in globalThis", () => {
    // deno-lint-ignore no-explicit-any
    const stack = new (globalThis as any).AsyncDisposableStack();
    assertInstanceOf(stack, Object);
    assertEquals(typeof stack.disposeAsync, "function");
    assertEquals(typeof stack.use, "function");
    assertEquals(typeof stack.adopt, "function");
    assertEquals(typeof stack.defer, "function");
    assertEquals(typeof stack.move, "function");

    // Clean up
    stack.disposeAsync();
  });

  it("should allow using DisposableStack functionality", () => {
    // deno-lint-ignore no-explicit-any
    const DisposableStack = (globalThis as any).DisposableStack;
    const stack = new DisposableStack();
    let disposed = false;

    stack.defer(() => {
      disposed = true;
    });

    assertEquals(disposed, false);
    stack.dispose();
    assertEquals(disposed, true);
  });

  it("should allow using AsyncDisposableStack functionality", async () => {
    // deno-lint-ignore no-explicit-any
    const AsyncDisposableStack = (globalThis as any).AsyncDisposableStack;
    const stack = new AsyncDisposableStack();
    let disposed = false;

    stack.defer(async () => {
      await Promise.resolve();
      disposed = true;
    });

    assertEquals(disposed, false);
    await stack.disposeAsync();
    assertEquals(disposed, true);
  });
});
