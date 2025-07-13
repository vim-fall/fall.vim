import type { Denops } from "@denops/std";
import * as buffer from "@denops/std/buffer";
import * as vars from "@denops/std/variable";
import * as autocmd from "@denops/std/autocmd";
import { TextLineStream } from "@std/streams/text-line-stream";
import { mergeReadableStreams } from "@std/streams/merge-readable-streams";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import { dirname } from "@std/path/dirname";
import { copy } from "@std/fs/copy";
import { buildRefineSetting, type Setting } from "@vim-fall/custom/setting";
import {
  type ActionPickerParams,
  buildRefineActionPicker,
} from "@vim-fall/custom/action-picker";
import {
  buildDefinePickerFromCurator,
  buildDefinePickerFromSource,
  type PickerParams,
} from "@vim-fall/custom/picker";

import { modern } from "@vim-fall/std/builtin/coordinator/modern";
import { MODERN_THEME } from "@vim-fall/std/builtin/theme/modern";
import { fzf } from "@vim-fall/std/builtin/matcher/fzf";

import { ExpectedError } from "./error.ts";

const defaultCustomUrl = new URL(
  "./_assets/default.custom.ts",
  import.meta.url,
);
let initialized: undefined | Promise<void>;

const defaultSetting: Setting = {
  coordinator: modern(),
  theme: MODERN_THEME,
};
let setting = { ...defaultSetting };

const defaultActionPickerParams: ActionPickerParams = {
  matchers: [fzf()],
  coordinator: modern({
    widthRatio: 0.4,
    heightRatio: 0.4,
    hidePreview: true,
  }),
};
let actionPickerParams = { ...defaultActionPickerParams };

const pickerParamsMap = new Map<string, PickerParams>();

/**
 * Edit user custom
 */
export async function editUserCustom(
  denops: Denops,
  options: buffer.OpenOptions,
): Promise<void> {
  const path = fromFileUrl(await getUserCustomUrl(denops));
  // Try to copy the default custom file if the user custom file does not exist.
  try {
    const parent = dirname(path);
    await Deno.mkdir(parent, { recursive: true });
    await copy(defaultCustomUrl, path, { overwrite: false });
  } catch (err) {
    if (err instanceof Deno.errors.AlreadyExists) {
      // Expected. Do nothing.
    } else {
      throw err;
    }
  }
  // Open the user custom file.
  const info = await buffer.open(denops, path, options);
  // Register autocmd to reload the user custom when the buffer is written.
  await autocmd.group(denops, "fall_config", (helper) => {
    helper.remove("*");
    helper.define(
      "BufWritePost",
      `<buffer=${info.bufnr}>`,
      `call denops#notify("${denops.name}", "custom:reload", [#{ verbose: v:true }])`,
    );
  });
}

/**
 * Load user custom from the g:fall_config_path.
 */
export function loadUserCustom(
  denops: Denops,
  { reload = false, verbose = false } = {},
): Promise<void> {
  if (initialized && !reload) {
    return initialized;
  }
  // Avoid reloading when the user custom is not yet loaded.
  reload = initialized ? reload : false;
  initialized = (async () => {
    const configUrl = await getUserCustomUrl(denops);
    const suffix = reload ? `#${performance.now()}` : "";
    try {
      const { main } = await import(`${configUrl.href}${suffix}`);
      reset();
      await main(buildContext(denops));
      await autocmd.emit(denops, "User", "FallCustomLoaded");
      if (verbose) {
        await denops.cmd(
          `echomsg "[fall] User custom is loaded: ${configUrl}"`,
        );
      }
    } catch (err) {
      // Avoid loading default configration if reload is set to keep the previous configuration.
      if (reload) {
        if (err instanceof Deno.errors.NotFound) {
          console.debug(`User custom not found: '${configUrl}'. Skip.`);
        } else {
          console.warn(`Failed to load user custom. Skip: ${err}`);
        }
        return;
      }
      // Fallback to the default configuration.
      if (err instanceof Deno.errors.NotFound) {
        console.debug(
          `User custom not found: '${configUrl}'. Fallback to the default custom.`,
        );
      } else {
        console.warn(
          `Failed to load user custom. Fallback to the default custom: ${err}`,
        );
      }
      const { main } = await import(defaultCustomUrl.href);
      reset();
      await main(buildContext(denops));
      if (verbose) {
        await denops.cmd(
          `echomsg "[fall] Default custom is loaded: ${defaultCustomUrl}"`,
        );
      }
    }
  })();
  return initialized;
}

/**
 * Recache user custom by running `deno cache --reload` command.
 */
export async function recacheUserCustom(
  denops: Denops,
  { verbose, signal }: { verbose?: boolean; signal?: AbortSignal },
): Promise<void> {
  const configUrl = await getUserCustomUrl(denops);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["cache", "--no-lock", "--reload", "--allow-import", configUrl.href],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  await using proc = cmd.spawn();
  signal?.addEventListener("abort", () => {
    try {
      proc.kill();
    } catch {
      // Do nothing
    }
  }, { once: true });
  mergeReadableStreams(proc.stdout, proc.stderr)
    .pipeThrough(new TextDecoderStream(), { signal })
    .pipeThrough(new TextLineStream(), { signal })
    .pipeTo(
      new WritableStream({
        async start() {
          if (verbose) {
            await denops.cmd(
              `redraw | echomsg "[fall] Recaching Deno modules referred in user custom: ${configUrl}"`,
            );
          }
        },
        async write(line) {
          if (verbose) {
            await denops.cmd(
              `redraw | echohl Comment | echomsg "[fall] ${line}" | echohl NONE`,
            );
          }
        },
        async close() {
          await autocmd.emit(denops, "User", "FallCustomRecached");
          if (verbose) {
            await denops.cmd(
              `redraw | echomsg "[fall] The Deno modules referenced in user custom are re-cached. Restart Vim to apply the changes: ${configUrl}"`,
            );
          }
        },
      }),
      { signal },
    );
  await proc.status;
}

/**
 * Get global custom.
 */
export function getSetting(): Readonly<Setting> {
  return setting;
}

/**
 * Get action picker params.
 */
export function getActionPickerParams(): Readonly<
  ActionPickerParams
> {
  return actionPickerParams;
}

/**
 * Get item picker params.
 */
export function getPickerParams(
  name: string,
): Readonly<PickerParams> | undefined {
  const params = pickerParamsMap.get(name);
  if (params) {
    return params;
  }
  return undefined;
}

/**
 * List item picker names.
 */
export function listPickerNames(): readonly string[] {
  return Array.from(pickerParamsMap.keys());
}

function reset(): void {
  setting = { ...defaultSetting };
  actionPickerParams = { ...defaultActionPickerParams };
  pickerParamsMap.clear();
}

function buildContext(denops: Denops): {
  denops: Denops;
  refineSetting: ReturnType<typeof buildRefineSetting>;
  refineActionPicker: ReturnType<typeof buildRefineActionPicker>;
  definePickerFromSource: ReturnType<typeof buildDefinePickerFromSource>;
  definePickerFromCurator: ReturnType<typeof buildDefinePickerFromCurator>;
} {
  const definePickerFromSource = buildDefinePickerFromSource(pickerParamsMap);
  const definePickerFromCurator = buildDefinePickerFromCurator(pickerParamsMap);
  return {
    denops,
    refineSetting: buildRefineSetting(setting),
    refineActionPicker: buildRefineActionPicker(actionPickerParams),
    definePickerFromSource: (name, source, params) => {
      validatePickerName(name);
      validateActions(params.actions);
      return definePickerFromSource(name, source, params);
    },
    definePickerFromCurator: (name, curator, params) => {
      validatePickerName(name);
      validateActions(params.actions);
      return definePickerFromCurator(name, curator, params);
    },
  };
}

async function getUserCustomUrl(denops: Denops): Promise<URL> {
  try {
    const path = await vars.g.get(denops, "fall_custom_path") as string;
    return toFileUrl(path);
  } catch (err) {
    throw new Error(
      `Failed to get user custom path from 'g:fall_custom_path': ${err}`,
    );
  }
}

function validatePickerName(name: string): void {
  if (pickerParamsMap.has(name)) {
    throw new ExpectedError(`Picker '${name}' is already defined.`);
  }
  if (name.startsWith("@")) {
    throw new ExpectedError(`Picker name must not start with '@': ${name}`);
  }
}

function validateActions(actions: Record<PropertyKey, unknown>): void {
  Object.keys(actions).forEach((name) => {
    if (name.startsWith("@")) {
      throw new ExpectedError(`Action name must not start with '@': ${name}`);
    }
  });
}

export type { ActionPickerParams, PickerParams, Setting };
