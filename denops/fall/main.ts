/**
 * @module main
 *
 * Main entry point for the vim-fall Denops plugin.
 *
 * This module serves as the primary initialization point for vim-fall, a fuzzy finder
 * framework for Vim/Neovim built with Denops. It coordinates the initialization of
 * all major subsystems including custom configurations, event handling, picker
 * functionality, and submatch features.
 *
 * The module imports and executes initialization functions for each subsystem in a
 * specific order to ensure proper setup of the plugin's functionality.
 */

import "./lib/polyfill.ts";

import type { Entrypoint } from "jsr:@denops/std@^7.3.2";

import { main as mainCustom } from "./main/custom.ts";
import { main as mainEvent } from "./main/event.ts";
import { main as mainPicker } from "./main/picker.ts";
import { main as mainSubmatch } from "./main/submatch.ts";

/**
 * Main entry point function for the vim-fall plugin.
 *
 * This function is called by Denops when the plugin is loaded. It initializes
 * all the plugin's subsystems in the following order:
 *
 * 1. Custom configurations - Loads user-defined settings and customizations
 * 2. Event system - Sets up the internal event handling mechanism
 * 3. Picker system - Initializes the core picker functionality
 * 4. Submatch system - Sets up submatch highlighting capabilities
 *
 * @param denops - The Denops instance provided by the Denops plugin system
 * @returns A promise that resolves when all subsystems are initialized
 *
 * @example
 * ```typescript
 * // This function is automatically called by Denops
 * // No manual invocation is required
 * ```
 */
export const main: Entrypoint = async (denops) => {
  await mainCustom(denops);
  await mainEvent(denops);
  await mainPicker(denops);
  await mainSubmatch(denops);
};
