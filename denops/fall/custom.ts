/**
 * @module custom
 *
 * Custom configuration management for vim-fall.
 *
 * This module handles loading, managing, and reloading user customizations
 * for vim-fall. It provides APIs for:
 *
 * - Loading user custom configuration files
 * - Managing global settings (theme, coordinator)
 * - Registering custom pickers
 * - Configuring action pickers
 * - Editing and reloading configurations
 *
 * The custom system allows users to define their own pickers, customize
 * existing ones, and configure the overall appearance and behavior of
 * vim-fall through a TypeScript configuration file.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import * as buffer from "jsr:@denops/std@^7.3.2/buffer";
import * as vars from "jsr:@denops/std@^7.3.2/variable";
import * as autocmd from "jsr:@denops/std@^7.3.2/autocmd";
import { TextLineStream } from "jsr:@std/streams@^1.0.8/text-line-stream";
import { mergeReadableStreams } from "jsr:@std/streams@^1.0.8/merge-readable-streams";
import { toFileUrl } from "jsr:@std/path@^1.0.8/to-file-url";
import { fromFileUrl } from "jsr:@std/path@^1.0.8/from-file-url";
import { dirname } from "jsr:@std/path@^1.0.8/dirname";
import { copy } from "jsr:@std/fs@^1.0.5/copy";
import {
  buildRefineSetting,
  type Setting,
} from "jsr:@vim-fall/custom@^0.1.0/setting";
import {
  type ActionPickerParams,
  buildRefineActionPicker,
} from "jsr:@vim-fall/custom@^0.1.0/action-picker";
import {
  buildDefinePickerFromCurator,
  buildDefinePickerFromSource,
  type PickerParams,
} from "jsr:@vim-fall/custom@^0.1.0/picker";

import { modern } from "jsr:@vim-fall/std@^0.10.0/builtin/coordinator/modern";
import { MODERN_THEME } from "jsr:@vim-fall/std@^0.10.0/builtin/theme/modern";
import { fzf } from "jsr:@vim-fall/std@^0.10.0/builtin/matcher/fzf";

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
 * Opens the user custom configuration file for editing.
 *
 * This function:
 * - Creates the custom file from a template if it doesn't exist
 * - Opens the file in a new buffer
 * - Sets up auto-reload on save
 *
 * @param denops - The Denops instance
 * @param options - Buffer open options (split, vsplit, etc.)
 * @returns A promise that resolves when the file is opened
 *
 * @example
 * ```typescript
 * // Open custom file in a vertical split
 * await editUserCustom(denops, { mods: "vertical" });
 * ```
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
 * Loads the user custom configuration from the path specified in g:fall_custom_path.
 *
 * This function:
 * - Loads the custom TypeScript module
 * - Executes its main function with the configuration context
 * - Falls back to default configuration on error
 * - Emits User:FallCustomLoaded autocmd on success
 *
 * @param denops - The Denops instance
 * @param options - Loading options
 * @param options.reload - Force reload even if already loaded
 * @param options.verbose - Show loading messages
 * @returns A promise that resolves when loading is complete
 *
 * @example
 * ```typescript
 * // Initial load
 * await loadUserCustom(denops);
 *
 * // Force reload with verbose output
 * await loadUserCustom(denops, { reload: true, verbose: true });
 * ```
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
 * Recaches the user custom file and its dependencies.
 *
 * This function runs `deno cache --reload` on the custom file to:
 * - Download and update all dependencies
 * - Recompile TypeScript code
 * - Clear the module cache
 *
 * After recaching, Vim must be restarted for changes to take effect.
 *
 * @param denops - The Denops instance
 * @param options - Recache options
 * @param options.verbose - Show cache progress
 * @param options.signal - AbortSignal to cancel the operation
 * @returns A promise that resolves when recaching is complete
 *
 * @example
 * ```typescript
 * // Recache with progress output
 * await recacheUserCustom(denops, { verbose: true });
 * ```
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
 * Gets the current global settings.
 *
 * @returns The current setting configuration including theme and coordinator
 *
 * @example
 * ```typescript
 * const settings = getSetting();
 * console.log("Current theme:", settings.theme);
 * ```
 */
export function getSetting(): Readonly<Setting> {
  return setting;
}

/**
 * Gets the current action picker parameters.
 *
 * Action pickers are used for selecting actions to perform on items.
 *
 * @returns The current action picker configuration
 *
 * @example
 * ```typescript
 * const params = getActionPickerParams();
 * console.log("Action picker matchers:", params.matchers);
 * ```
 */
export function getActionPickerParams(): Readonly<
  ActionPickerParams
> {
  return actionPickerParams;
}

/**
 * Gets the parameters for a specific picker by name.
 *
 * @param name - The name of the picker
 * @returns The picker parameters if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const filePickerParams = getPickerParams("file");
 * if (filePickerParams) {
 *   console.log("File picker source:", filePickerParams.source);
 * }
 * ```
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
 * Lists all registered picker names.
 *
 * @returns An array of all registered picker names
 *
 * @example
 * ```typescript
 * const pickers = listPickerNames();
 * console.log("Available pickers:", pickers);
 * // Output: ["file", "grep", "buffer", ...]
 * ```
 */
export function listPickerNames(): readonly string[] {
  return Array.from(pickerParamsMap.keys());
}

/**
 * Resets all custom configurations to their defaults.
 * This is called before loading/reloading custom configurations.
 */
function reset(): void {
  setting = { ...defaultSetting };
  actionPickerParams = { ...defaultActionPickerParams };
  pickerParamsMap.clear();
}

/**
 * Builds the context object passed to custom configuration files.
 *
 * This context provides APIs for:
 * - Refining global settings
 * - Configuring action pickers
 * - Defining new pickers from sources or curators
 *
 * @param denops - The Denops instance
 * @returns The configuration context object
 */
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

/**
 * Gets the URL of the user custom file from g:fall_custom_path.
 *
 * @param denops - The Denops instance
 * @returns The file URL of the custom configuration
 * @throws Error if g:fall_custom_path is not set or invalid
 */
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

/**
 * Validates a picker name to ensure it's valid and not already used.
 *
 * @param name - The picker name to validate
 * @throws ExpectedError if the name is invalid or already exists
 */
function validatePickerName(name: string): void {
  if (pickerParamsMap.has(name)) {
    throw new ExpectedError(`Picker '${name}' is already defined.`);
  }
  if (name.startsWith("@")) {
    throw new ExpectedError(`Picker name must not start with '@': ${name}`);
  }
}

/**
 * Validates action names to ensure they don't use reserved prefixes.
 *
 * @param actions - The actions object to validate
 * @throws ExpectedError if any action name starts with '@'
 */
function validateActions(actions: Record<PropertyKey, unknown>): void {
  Object.keys(actions).forEach((name) => {
    if (name.startsWith("@")) {
      throw new ExpectedError(`Action name must not start with '@': ${name}`);
    }
  });
}

export type { ActionPickerParams, PickerParams, Setting };
