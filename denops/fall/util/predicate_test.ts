import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { describe, it } from "jsr:@std/testing@^1.0.0/bdd";
import type { Detail, Matcher, Theme } from "jsr:@vim-fall/core@^0.3.0";

import {
  isAbortSignal,
  isAction,
  isCoordinator,
  isCurator,
  isIncrementalMatcher,
  isMatcher,
  isOptions,
  isPickerParams,
  isPreviewer,
  isRenderer,
  isSetting,
  isSorter,
  isSource,
  isStringArray,
  isTheme,
} from "./predicate.ts";

describe("isStringArray", () => {
  it("should return true for string arrays", () => {
    assertEquals(isStringArray([]), true);
    assertEquals(isStringArray(["a", "b", "c"]), true);
    assertEquals(isStringArray(["hello", "world"]), true);
  });

  it("should return false for non-string arrays", () => {
    assertEquals(isStringArray([1, 2, 3]), false);
    assertEquals(isStringArray(["a", 1, "c"]), false);
    assertEquals(isStringArray(null), false);
    assertEquals(isStringArray(undefined), false);
    assertEquals(isStringArray("string"), false);
    assertEquals(isStringArray({}), false);
  });
});

describe("isAbortSignal", () => {
  it("should return true for AbortSignal instances", () => {
    const controller = new AbortController();
    assertEquals(isAbortSignal(controller.signal), true);
  });

  it("should return false for non-AbortSignal values", () => {
    assertEquals(isAbortSignal({}), false);
    assertEquals(isAbortSignal(null), false);
    assertEquals(isAbortSignal(undefined), false);
    assertEquals(isAbortSignal("signal"), false);
  });
});

describe("isTheme", () => {
  it("should return true for valid theme objects", () => {
    const theme: Theme = {
      border: ["a", "b", "c", "d", "e", "f", "g", "h"],
      divider: ["a", "b", "c", "d", "e", "f"],
    };
    assertEquals(isTheme(theme), true);
  });

  it("should return false for invalid theme objects", () => {
    assertEquals(isTheme({}), false);
    assertEquals(isTheme({ border: [], divider: [] }), false);
    assertEquals(isTheme({ border: ["a"], divider: ["a"] }), false);
    assertEquals(
      isTheme({
        border: ["a", "b", "c", "d", "e", "f", "g"],
        divider: ["a", "b", "c", "d", "e", "f"],
      }),
      false,
    );
  });
});

describe("isCoordinator", () => {
  it("should return true for valid coordinator objects", () => {
    const coordinator = {
      style: () => {},
      layout: () => ({ width: 10, height: 10 }),
    };
    assertEquals(isCoordinator(coordinator), true);
  });

  it("should return false for invalid coordinator objects", () => {
    assertEquals(isCoordinator({}), false);
    assertEquals(isCoordinator({ style: () => {} }), false);
    assertEquals(isCoordinator({ layout: () => {} }), false);
    assertEquals(
      isCoordinator({ style: "not a function", layout: () => {} }),
      false,
    );
  });
});

describe("isCurator", () => {
  it("should return true for valid curator objects", () => {
    const curator = {
      curate: async function* () {
        yield { value: "test" };
      },
    };
    assertEquals(isCurator(curator), true);
  });

  it("should return false for invalid curator objects", () => {
    assertEquals(isCurator({}), false);
    assertEquals(isCurator({ curate: "not a function" }), false);
  });
});

describe("isSource", () => {
  it("should return true for valid source objects", () => {
    const source = {
      collect: async function* () {
        yield { value: "test" };
      },
    };
    assertEquals(isSource(source), true);
  });

  it("should return false for invalid source objects", () => {
    assertEquals(isSource({}), false);
    assertEquals(isSource({ collect: "not a function" }), false);
  });
});

describe("isMatcher", () => {
  it("should return true for valid matcher objects", () => {
    const matcher = {
      match: async function* () {
        yield { value: "test", score: 1 };
      },
    };
    assertEquals(isMatcher(matcher), true);
  });

  it("should return false for invalid matcher objects", () => {
    assertEquals(isMatcher({}), false);
    assertEquals(isMatcher({ match: "not a function" }), false);
  });
});

describe("isSorter", () => {
  it("should return true for valid sorter objects", () => {
    const sorter = {
      sort: async function* () {
        yield { value: "test", score: 1 };
      },
    };
    assertEquals(isSorter(sorter), true);
  });

  it("should return false for invalid sorter objects", () => {
    assertEquals(isSorter({}), false);
    assertEquals(isSorter({ sort: "not a function" }), false);
  });
});

describe("isRenderer", () => {
  it("should return true for valid renderer objects", () => {
    const renderer = {
      render: () => Promise.resolve([]),
    };
    assertEquals(isRenderer(renderer), true);
  });

  it("should return false for invalid renderer objects", () => {
    assertEquals(isRenderer({}), false);
    assertEquals(isRenderer({ render: "not a function" }), false);
  });
});

describe("isPreviewer", () => {
  it("should return true for valid previewer objects", () => {
    const previewer = {
      preview: () => Promise.resolve([]),
    };
    assertEquals(isPreviewer(previewer), true);
  });

  it("should return false for invalid previewer objects", () => {
    assertEquals(isPreviewer({}), false);
    assertEquals(isPreviewer({ preview: "not a function" }), false);
  });
});

describe("isAction", () => {
  it("should return true for valid action objects", () => {
    const action = {
      invoke: () => Promise.resolve(),
    };
    assertEquals(isAction(action), true);
  });

  it("should return false for invalid action objects", () => {
    assertEquals(isAction({}), false);
    assertEquals(isAction({ invoke: "not a function" }), false);
  });
});

describe("isSetting", () => {
  it("should return true for valid setting objects", () => {
    const setting = {
      coordinator: {
        style: () => {},
        layout: () => ({ width: 10, height: 10 }),
      },
      theme: {
        border: ["a", "b", "c", "d", "e", "f", "g", "h"],
        divider: ["a", "b", "c", "d", "e", "f"],
      },
    };
    assertEquals(isSetting(setting), true);
  });

  it("should return false for invalid setting objects", () => {
    assertEquals(isSetting({}), false);
    assertEquals(isSetting({ coordinator: {} }), false);
    assertEquals(isSetting({ theme: {} }), false);
  });
});

describe("isPickerParams", () => {
  it("should return true for valid picker params", () => {
    const params = {
      name: "test",
      source: {
        collect: async function* () {
          yield { value: "test" };
        },
      },
      actions: {
        default: { invoke: async () => {} },
      },
      defaultAction: "default",
      matchers: [{ match: async function* () {} }],
    };
    assertEquals(isPickerParams(params), true);
  });

  it("should return true for params with optional fields", () => {
    const params = {
      name: "test",
      source: {
        collect: async function* () {
          yield { value: "test" };
        },
      },
      actions: {
        default: { invoke: async () => {} },
      },
      defaultAction: "default",
      matchers: [{ match: async function* () {} }],
      sorters: [{ sort: async function* () {} }],
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
    assertEquals(isPickerParams(params), true);
  });

  it("should return false for invalid picker params", () => {
    assertEquals(isPickerParams({}), false);
    assertEquals(isPickerParams({ name: "test" }), false);
    assertEquals(
      isPickerParams({
        name: "test",
        source: {
          collect: async function* () {
            yield { value: "test" };
          },
        },
      }),
      false,
    );
  });
});

describe("isOptions", () => {
  it("should return true for valid options", () => {
    assertEquals(isOptions({}), true);
    assertEquals(isOptions({ signal: new AbortController().signal }), true);
  });

  it("should return false for invalid options", () => {
    assertEquals(isOptions({ signal: "not a signal" }), false);
    assertEquals(isOptions(null), false);
    assertEquals(isOptions(undefined), false);
  });
});

describe("isIncrementalMatcher", () => {
  it("should return true for incremental matchers", () => {
    const matcher = {
      match: async function* () {},
      incremental: true,
    };
    assertEquals(isIncrementalMatcher(matcher as Matcher<Detail>), true);
  });

  it("should return false for non-incremental matchers", () => {
    const matcher = {
      match: async function* () {},
      incremental: false,
    };
    assertEquals(isIncrementalMatcher(matcher as Matcher<Detail>), false);
  });

  it("should return false when incremental property is not set", () => {
    const matcher = {
      match: async function* () {},
    };
    assertEquals(isIncrementalMatcher(matcher as Matcher<Detail>), false);
  });
});
