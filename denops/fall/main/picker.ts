import type { Denops, Entrypoint } from "jsr:@denops/std@^7.3.2";
import { ensurePromise } from "jsr:@core/asyncutil@^1.2.0/ensure-promise";
import { assert, ensure, is } from "jsr:@core/unknownutil@^4.3.0";
import type { Detail } from "jsr:@vim-fall/core@^0.3.0/item";

import type { PickerParams } from "../custom.ts";
import {
  getActionPickerParams,
  getPickerParams,
  getSetting,
  listPickerNames,
  loadUserCustom,
} from "../custom.ts";
import { isOptions, isPickerParams, isStringArray } from "../util/predicate.ts";
import { action as buildActionSource } from "../extension/source/action.ts";
import { Picker, type PickerContext } from "../picker.ts";
import type { SubmatchContext } from "./submatch.ts";
import { ExpectedError, withHandleError } from "../error.ts";
import {
  listPickerSessions,
  loadPickerSession,
  savePickerSession,
} from "../session.ts";
import type { Detail as SessionDetail } from "../extension/source/session.ts";
import { session as sessionSource } from "../extension/source/session.ts";
import { session as sessionRenderer } from "../extension/renderer/session.ts";
import { session as sessionPreviewer } from "../extension/previewer/session.ts";
import { defaultSessionActions } from "../extension/action/session.ts";

let zindex = 50;

const SESSION_EXCLUDE_SOURCES = [
  "@action",
  "@session",
];

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    ...denops.dispatcher,
    "picker": (args, itemPickerParams, options) => {
      assert(args, isStringArray);
      assert(itemPickerParams, isPickerParams);
      assert(options, isOptions);
      return startPicker(denops, args, itemPickerParams, options);
    },
    "picker:command": withHandleError(denops, async (args) => {
      await loadUserCustom(denops);
      // Split the command arguments
      const [name, ...sourceArgs] = ensure(args, isStringArray);

      // Load user custom
      const itemPickerParams = getPickerParams(name);
      if (!itemPickerParams) {
        throw new ExpectedError(
          `No item picker "${name}" is found. Available item pickers are: ${
            listPickerNames().join(", ")
          }`,
        );
      }
      await startPicker(
        denops,
        sourceArgs,
        itemPickerParams,
        { signal: denops.interrupted },
      );
    }),
    "picker:command:complete": withHandleError(
      denops,
      async (arglead, cmdline, cursorpos) => {
        await loadUserCustom(denops);
        assert(arglead, is.String);
        assert(cmdline, is.String);
        assert(cursorpos, is.Number);
        return listPickerNames().filter((name) => name.startsWith(arglead));
      },
    ),
    "picker:resume:command": withHandleError(
      denops,
      async (filter) => {
        assert(filter, is.UnionOf([is.String, is.Nullish]));
        await loadUserCustom(denops);
        return await resumePicker(denops, filter ?? "", {
          signal: denops.interrupted,
        });
      },
    ),
    "picker:session:command": withHandleError(denops, async () => {
      await loadUserCustom(denops);
      const { substring } = await import(
        "jsr:@vim-fall/std@^0.10.0/builtin/matcher/substring"
      );
      const setting = getSetting();
      const sessionPickerParams = {
        name: "@session",
        source: sessionSource(),
        matchers: [substring()] as const,
        sorters: [],
        renderers: [sessionRenderer()],
        previewers: [sessionPreviewer()],
        actions: defaultSessionActions,
        defaultAction: "resume",
        ...setting,
      } as PickerParams<SessionDetail, string>;
      await startPicker(
        denops,
        [],
        sessionPickerParams,
        { signal: denops.interrupted },
      );
    }),
    "picker:resume:command:complete": withHandleError(
      denops,
      async (arglead, cmdline, cursorpos) => {
        await loadUserCustom(denops);
        assert(arglead, is.String);
        assert(cmdline, is.String);
        assert(cursorpos, is.Number);
        const sessions = listPickerSessions();
        if (cmdline.includes("#")) {
          // Resume by filter
          const [name] = arglead.split("#", 2);
          const filteredSessions = name
            ? sessions.filter((s) => s.name === name)
            : sessions;
          const candidates = Array.from(
            { length: filteredSessions.length },
            (_, i) => {
              return `${name}#${i + 1}`;
            },
          );
          return candidates.filter((c) => c.startsWith(arglead));
        } else {
          // Resume by name
          const candidates = sessions.map((s) => s.name);
          return candidates.filter((c) => c.startsWith(arglead));
        }
      },
    ),
  };
};

async function resumePicker(
  denops: Denops,
  filter: string,
  { signal }: {
    signal?: AbortSignal;
  } = {},
): Promise<void | true> {
  // Parse filter ({name}#{indexFromLatest})
  const [filterName, filterNumberStr = "1"] = filter.split("#", 2);
  const filterNumber = Number(filterNumberStr);
  const session = await loadPickerSession({
    name: filterName,
    number: filterNumber,
  });
  if (!session) {
    throw new ExpectedError(
      `Picker session ${filterName}#${filterNumberStr} is not available.`,
    );
  }
  // Load user custom
  const pickerParams = getPickerParams(session.name);
  if (!pickerParams) {
    throw new ExpectedError(
      `No item picker "${session.name}" is found. Available item pickers are: ${
        listPickerNames().join(", ")
      }`,
    );
  }
  const { args, context } = session;
  await startPicker(
    denops,
    args,
    pickerParams,
    { signal, context },
  );
}

async function startPicker<T extends Detail>(
  denops: Denops,
  args: readonly string[],
  pickerParams: PickerParams<T, string>,
  { signal, context }: {
    signal?: AbortSignal;
    context?: PickerContext<T>;
  } = {},
): Promise<void | true> {
  await using stack = new AsyncDisposableStack();
  const setting = getSetting();
  const itemPicker = stack.use(
    new Picker({
      ...setting,
      ...pickerParams,
      zindex,
      context,
    }),
  );
  zindex += Picker.ZINDEX_ALLOCATION;
  stack.defer(() => {
    zindex -= Picker.ZINDEX_ALLOCATION;
  });
  const actionPicker = stack.use(
    new Picker({
      name: "@action",
      source: buildActionSource(pickerParams.actions),
      ...setting,
      ...getActionPickerParams(),
      zindex,
    }),
  );
  zindex += Picker.ZINDEX_ALLOCATION;
  stack.defer(() => {
    zindex -= Picker.ZINDEX_ALLOCATION;
  });
  stack.defer(async () => {
    const name = pickerParams.name;
    if (SESSION_EXCLUDE_SOURCES.includes(name)) {
      return;
    }
    await savePickerSession({
      name,
      args,
      context: itemPicker.context,
    });
  });

  stack.use(await itemPicker.open(denops, { signal }));
  while (true) {
    // Redraw the screen to clean up the closed action picker
    await denops.cmd("redraw");

    // Select items
    const resultItem = await itemPicker.start(
      denops,
      { args },
      { signal },
    );
    if (!resultItem) {
      // Cancelled
      return true;
    }

    // Select an action
    let actionName: string;
    if (resultItem.action === "@select") {
      // Open the action picker to select an action
      await using _guardActionPicker = await actionPicker.open(denops, {
        signal,
      });
      const resultAction = await actionPicker.start(
        denops,
        { args: [] },
        { signal },
      );
      if (!resultAction) {
        // Return to the item picker
        continue;
      }
      if (!resultAction.item) {
        // Cancelled
        return true;
      }
      actionName = resultAction.item.value;
    } else if (resultItem.action) {
      actionName = resultItem.action;
    } else {
      // Default action
      actionName = pickerParams.defaultAction;
    }

    // Execute the action
    const action = pickerParams.actions[actionName];
    if (!action) {
      throw new ExpectedError(
        `No action "${actionName}" is found. Available actions are: ${
          Object.keys(pickerParams.actions).join(
            ", ",
          )
        }`,
      );
    }
    const actionParams = {
      // Secret attribute for @vim-fall/std/builtin/action/submatch
      _submatch: {
        pickerParams,
      },
      ...resultItem,
    } as const satisfies SubmatchContext<T>;
    if (await ensurePromise(action.invoke(denops, actionParams, { signal }))) {
      // Picker should not be closed
      continue;
    }
    // Successfully completed
    return;
  }
}
