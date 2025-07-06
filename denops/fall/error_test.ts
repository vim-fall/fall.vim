import { DenopsStub } from "jsr:@denops/test@^3.0.0";
import { assertEquals, assertInstanceOf } from "jsr:@std/assert@^1.0.0";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import { AssertError } from "jsr:@core/unknownutil@^4.3.0/assert";
import { ExpectedError, handleError, withHandleError } from "./error.ts";

describe("ExpectedError", () => {
  it("should create an error with message", () => {
    const error = new ExpectedError("test message");
    assertInstanceOf(error, Error);
    assertEquals(error.message, "test message");
    assertEquals(error.source, undefined);
  });

  it("should create an error with message and source", () => {
    const source = new Error("source error");
    const error = new ExpectedError("test message", source);
    assertEquals(error.message, "test message");
    assertEquals(error.source, source);
  });
});

describe("handleError", () => {
  it("should handle ExpectedError by showing echo message", async () => {
    const called: string[] = [];
    const denops = new DenopsStub({
      cmd(command: string): Promise<void> {
        called.push(command);
        return Promise.resolve();
      },
    });
    const error = new ExpectedError("expected error");

    await handleError(denops, error);

    assertEquals(called.length, 1);
    assertEquals(
      called[0],
      "redraw | echohl Error | echomsg '[fall] expected error' | echohl None",
    );
  });

  it("should handle AssertError by showing echo message", async () => {
    const called: string[] = [];
    const denops = new DenopsStub({
      cmd(command: string): Promise<void> {
        called.push(command);
        return Promise.resolve();
      },
    });
    const error = new AssertError("assertion failed");

    await handleError(denops, error);

    assertEquals(called.length, 1);
    assertEquals(
      called[0],
      "redraw | echohl Error | echomsg '[fall] assertion failed' | echohl None",
    );
  });

  it("should handle unknown errors by logging to console", async () => {
    const called: string[] = [];
    const denops = new DenopsStub({
      cmd(command: string): Promise<void> {
        called.push(command);
        return Promise.resolve();
      },
    });
    const error = new Error("unknown error");
    const originalConsoleError = console.error;
    let capturedError: unknown;

    console.error = (err: unknown) => {
      capturedError = err;
    };

    try {
      await handleError(denops, error);
      assertEquals(capturedError, error);
      assertEquals(called.length, 0);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("withHandleError", () => {
  it("should return the result when no error occurs", async () => {
    const denops = new DenopsStub();
    const fn = (x: number, y: number) => x + y;
    const wrapped = withHandleError(denops, fn);

    const result = await wrapped(1, 2);
    assertEquals(result, 3);
  });

  it("should return the result for async functions", async () => {
    const denops = new DenopsStub();
    const fn = async (x: number, y: number) => {
      await Promise.resolve();
      return x + y;
    };
    const wrapped = withHandleError(denops, fn);

    const result = await wrapped(1, 2);
    assertEquals(result, 3);
  });

  it("should handle errors and return undefined", async () => {
    const called: string[] = [];
    const denops = new DenopsStub({
      cmd(command: string): Promise<void> {
        called.push(command);
        return Promise.resolve();
      },
    });
    const fn = () => {
      throw new ExpectedError("test error");
    };
    const wrapped = withHandleError(denops, fn);

    const result = await wrapped();
    assertEquals(result, undefined);

    // Wait for setTimeout to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    assertEquals(called.length, 1);
    assertEquals(
      called[0],
      "redraw | echohl Error | echomsg '[fall] test error' | echohl None",
    );
  });

  it("should handle async function errors", async () => {
    const denops = new DenopsStub();
    const fn = async () => {
      await Promise.resolve();
      throw new Error("async error");
    };
    const wrapped = withHandleError(denops, fn);

    const originalConsoleError = console.error;
    let capturedError: unknown;

    console.error = (err: unknown) => {
      capturedError = err;
    };

    try {
      const result = await wrapped();
      assertEquals(result, undefined);

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      assertInstanceOf(capturedError, Error);
      assertEquals((capturedError as Error).message, "async error");
    } finally {
      console.error = originalConsoleError;
    }
  });
});
