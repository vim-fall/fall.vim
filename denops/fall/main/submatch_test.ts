import { DenopsStub } from "jsr:@denops/test@^3.0.0";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";

import { main } from "./submatch.ts";

describe("submatch", () => {
  it("should register submatch dispatcher", () => {
    const denops = new DenopsStub();
    main(denops);

    assertEquals(typeof denops.dispatcher["submatch"], "function");
  });

  it("should handle invalid context gracefully", async () => {
    const denops = new DenopsStub();
    main(denops);

    // withHandleError catches errors, so it won't reject but return undefined
    const result = await denops.dispatcher["submatch"]({}, {}, {});
    assertEquals(result, undefined);
  });

  it("should handle invalid params gracefully", async () => {
    const denops = new DenopsStub();
    main(denops);

    const validContext = {
      filteredItems: [],
      _submatch: {
        pickerParams: {
          name: "test",
          source: {
            collect: async function* () {
              yield { value: "test" };
            },
          },
          actions: { default: { invoke: async () => {} } },
          defaultAction: "default",
          matchers: [{
            match: async function* () {
              yield { value: "test", score: 1 };
            },
          }],
        },
      },
    };

    // withHandleError catches errors, so it won't reject but return undefined
    const result = await denops.dispatcher["submatch"](validContext, {}, {});
    assertEquals(result, undefined);
  });

  it("should process valid submatch call", async () => {
    const denops = new DenopsStub();

    // Track dispatch calls
    let dispatchCalled = false;
    let dispatchArgs: unknown[] = [];

    denops.dispatch = (name: string, ...args: unknown[]) => {
      if (name === denops.name && args[0] === "picker") {
        dispatchCalled = true;
        dispatchArgs = args;
      }
      return Promise.resolve(undefined);
    };

    main(denops);

    const validContext = {
      filteredItems: [{ value: "item1" }, { value: "item2" }],
      _submatch: {
        pickerParams: {
          name: "test",
          source: {
            collect: async function* () {
              yield { value: "test" };
            },
          },
          actions: { default: { invoke: async () => {} } },
          defaultAction: "default",
          matchers: [{
            match: async function* () {
              yield { value: "test", score: 1 };
            },
          }],
        },
      },
    };

    const validParams = {
      matchers: [{
        match: async function* () {
          yield { value: "test", score: 1 };
        },
      }],
    };

    await denops.dispatcher["submatch"](validContext, validParams, {});

    assertEquals(dispatchCalled, true);
    assertEquals(dispatchArgs[0], "picker");
  });

  it("should forward optional parameters to picker", async () => {
    const denops = new DenopsStub();

    // Track dispatch calls
    let capturedPickerParams: unknown;

    denops.dispatch = (name: string, ...args: unknown[]) => {
      if (name === denops.name && args[0] === "picker") {
        capturedPickerParams = args[2]; // The picker params
      }
      return Promise.resolve(undefined);
    };

    main(denops);

    const validContext = {
      filteredItems: [{ value: "item1" }],
      selectedItems: [{ value: "selected" }],
      _submatch: {
        pickerParams: {
          name: "test",
          source: {
            collect: async function* () {
              yield { value: "test" };
            },
          },
          actions: { default: { invoke: async () => {} } },
          defaultAction: "default",
          matchers: [{
            match: async function* () {
              yield { value: "test", score: 1 };
            },
          }],
        },
      },
    };

    const validParams = {
      matchers: [{
        match: async function* () {
          yield { value: "test", score: 1 };
        },
      }],
      actions: { custom: { invoke: async () => {} } },
      defaultAction: "custom",
      sorters: [{
        sort: async function* () {
          yield { value: "test", score: 1 };
        },
      }],
      renderers: [{ render: () => Promise.resolve([]) }],
      previewers: [{ preview: () => Promise.resolve([]) }],
      coordinator: {
        style: () => {},
        layout: () => ({ width: 10, height: 10 }),
      },
      theme: {
        border: ["a", "b", "c", "d", "e", "f", "g", "h"],
        divider: ["a", "b", "c", "d", "e", "f"],
      },
    };

    await denops.dispatcher["submatch"](validContext, validParams, {});

    assertEquals(typeof capturedPickerParams, "object");
    const params = capturedPickerParams as Record<string, unknown>;
    assertEquals(params.defaultAction, "custom");
    assertEquals(Array.isArray(params.sorters), true);
    assertEquals(Array.isArray(params.renderers), true);
    assertEquals(Array.isArray(params.previewers), true);
    assertEquals(typeof params.coordinator, "object");
    assertEquals(typeof params.theme, "object");
  });

  it("should return true when picker returns true", async () => {
    const denops = new DenopsStub();

    denops.dispatch = (name: string, ...args: unknown[]) => {
      if (name === denops.name && args[0] === "picker") {
        return Promise.resolve(true);
      }
      return Promise.resolve(undefined);
    };

    main(denops);

    const validContext = {
      filteredItems: [],
      _submatch: {
        pickerParams: {
          name: "test",
          source: {
            collect: async function* () {
              yield { value: "test" };
            },
          },
          actions: { default: { invoke: async () => {} } },
          defaultAction: "default",
          matchers: [{
            match: async function* () {
              yield { value: "test", score: 1 };
            },
          }],
        },
      },
    };

    const validParams = {
      matchers: [{
        match: async function* () {
          yield { value: "test", score: 1 };
        },
      }],
    };

    const result = await denops.dispatcher["submatch"](
      validContext,
      validParams,
      {},
    );

    assertEquals(result, true);
  });
});
