import { test } from "jsr:@denops/test@^3.0.0";
import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { AssertError } from "jsr:@core/unknownutil@^4.3.0/assert";

import { main } from "./submatch.ts";

test({
  mode: "all",
  name: "submatch - register dispatcher",
  fn: async (denops) => {
    main(denops);

    assertEquals(typeof denops.dispatcher["submatch"], "function");
  },
});

test({
  mode: "all",
  name: "submatch - reject invalid context",
  fn: async (denops) => {
    main(denops);

    await assertRejects(
      async () => {
        await denops.dispatcher["submatch"]({}, {}, {});
      },
      AssertError,
    );
  },
});

test({
  mode: "all",
  name: "submatch - reject invalid params",
  fn: async (denops) => {
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

    await assertRejects(
      async () => {
        await denops.dispatcher["submatch"](validContext, {}, {});
      },
      AssertError,
    );
  },
});

test({
  mode: "all",
  name: "submatch - accept valid call",
  fn: async (denops) => {
    main(denops);

    // Mock the picker dispatcher
    const originalDispatcher = denops.dispatcher;
    let pickerCalled = false;
    denops.dispatcher = {
      ...originalDispatcher,
      picker: () => {
        pickerCalled = true;
        return Promise.resolve(undefined);
      },
    };

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

    assertEquals(pickerCalled, true);

    // Restore
    denops.dispatcher = originalDispatcher;
  },
});

test({
  mode: "all",
  name: "submatch - handle optional parameters",
  fn: async (denops) => {
    main(denops);

    // Mock the picker dispatcher
    const originalDispatcher = denops.dispatcher;
    let capturedParams: unknown;
    denops.dispatcher = {
      ...originalDispatcher,
      picker: (_args: unknown, params: unknown) => {
        capturedParams = params;
        return Promise.resolve(undefined);
      },
    };

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

    assertEquals(typeof capturedParams, "object");
    assertEquals(
      (capturedParams as Record<string, unknown>).defaultAction,
      "custom",
    );
    assertEquals(
      Array.isArray((capturedParams as Record<string, unknown>).sorters),
      true,
    );
    assertEquals(
      Array.isArray((capturedParams as Record<string, unknown>).renderers),
      true,
    );
    assertEquals(
      Array.isArray((capturedParams as Record<string, unknown>).previewers),
      true,
    );
    assertEquals(
      typeof (capturedParams as Record<string, unknown>).coordinator,
      "object",
    );
    assertEquals(
      typeof (capturedParams as Record<string, unknown>).theme,
      "object",
    );

    // Restore
    denops.dispatcher = originalDispatcher;
  },
});

test({
  mode: "all",
  name: "submatch - return true when picker returns true",
  fn: async (denops) => {
    main(denops);

    // Mock the picker dispatcher
    const originalDispatcher = denops.dispatcher;
    denops.dispatcher = {
      ...originalDispatcher,
      picker: () => {
        return Promise.resolve(true);
      },
    };

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

    // Restore
    denops.dispatcher = originalDispatcher;
  },
});
