/**
 * @module component/list
 *
 * List component for the vim-fall picker UI.
 *
 * This module provides the ListComponent class which manages the main list area
 * of the picker where filtered and rendered items are displayed. It handles:
 *
 * - Rendering items with syntax highlighting
 * - Managing item selection with visual indicators
 * - Executing commands on the list buffer
 * - Handling decorations for match highlighting
 *
 * The list component works closely with the render processor to display
 * items in a scrollable, interactive list format.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Decoration } from "jsr:@denops/std@^7.3.2/buffer";
import { batch } from "jsr:@denops/std@^7.3.2/batch";
import * as fn from "jsr:@denops/std@^7.3.2/function";
import * as buffer from "jsr:@denops/std@^7.3.2/buffer";
import type { Dimension } from "jsr:@vim-fall/core@^0.3.0/coordinator";

import { BaseComponent, ComponentProperties } from "./_component.ts";

export const HIGHLIGHT_MATCH = "FallListMatch";
export const SIGN_GROUP_SELECTED = "PopUpFallListSelected";
export const SIGN_SELECTED = "FallListSelected";

/**
 * Type representing the decoration properties of an item,
 * allowing customization of specific visual aspects.
 * `highlight` is optional and can be used to specify
 * a highlight group for a portion of the item's display.
 */
export type ItemDecoration =
  & Omit<Decoration, "line" | "highlight">
  & Partial<Pick<Decoration, "highlight">>;

/**
 * Type representing an item to be displayed in a list.
 * Each item has a unique identifier, a label for display,
 * and optional decorations for customizing its appearance.
 */
export type DisplayItem = {
  readonly id: unknown; // Unique identifier for the item.
  readonly label: string; // Text label to display for the item.
  readonly decorations: readonly ItemDecoration[]; // Array of decorations to apply to the item.
};

/**
 * ListComponent is a component for managing and rendering a list of display items.
 * It handles item selection, scrolling, and rendering of highlights and signs.
 */
export class ListComponent extends BaseComponent {
  #scroll = 1;
  #title = "";
  #items: readonly DisplayItem[] = [];
  #selection = new Set<unknown>();
  #modifiedContent = true;
  #modifiedSigns = true;
  #modifiedWindow = true;
  #reservedCommands: string[] = [];

  constructor(
    params: ComponentProperties = {},
  ) {
    super(params);
    this.#title = params.title ?? "";
  }

  /** The title of the input component */
  get title(): string {
    return this.#title;
  }

  /** Sets the title of the input component */
  set title(value: string) {
    this.#title = value;
    this.#modifiedWindow = true;
  }

  /**
   * Gets the scroll setting of the list.
   */
  get scroll(): number {
    return this.#scroll;
  }

  /**
   * Gets the current list of display items.
   */
  get items(): readonly DisplayItem[] {
    return this.#items;
  }

  /**
   * Sets the display items for the list and marks content as modified.
   * @param items - The new list of display items.
   */
  set items(items: readonly DisplayItem[]) {
    this.#items = items;
    this.#modifiedContent = true;
    this.#modifiedSigns = true;
  }

  /**
   * Gets the set of selected items.
   */
  get selection(): Set<unknown> {
    return this.#selection;
  }

  /**
   * Sets the selected items and marks signs as modified.
   * @param selection - A set of selected item identifiers.
   */
  set selection(selection: Set<unknown>) {
    this.#selection = selection;
    this.#modifiedSigns = true;
  }

  /**
   * Adds a command to be executed in the list's context.
   * @param command - The command to queue for execution.
   */
  execute(command: string): void {
    this.#reservedCommands.push(command);
  }

  /**
   * Forces the component to render its content and signs in the next render cycle.
   */
  forceRender(): void {
    this.#modifiedContent = true;
    this.#modifiedSigns = true;
  }

  override async open(
    denops: Denops,
    dimension: Readonly<Dimension>,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<AsyncDisposable> {
    await using stack = new AsyncDisposableStack();
    stack.use(await super.open(denops, dimension, { signal }));
    const { winid } = this.info!;

    signal?.throwIfAborted();
    await fn.win_execute(
      denops,
      winid,
      "setlocal cursorline cursorlineopt=line signcolumn=yes nowrap nolist nofoldenable nonumber norelativenumber filetype=fall-list",
    );

    signal?.throwIfAborted();
    this.#scroll = await fn.getwinvar(denops, winid, "&scroll") as number;
    this.forceRender();
    return stack.move();
  }

  override async move(
    denops: Denops,
    dimension: Dimension,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<void> {
    await super.move(denops, dimension, { signal });
    const { winid } = this.info!;

    // 'scroll' changes its default value by window height
    signal?.throwIfAborted();
    this.#scroll = await fn.getwinvar(denops, winid, "&scroll") as number;
  }

  override async render(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    try {
      const results = [
        await this.#renderWindow(denops, { signal }),
        await this.#renderContent(denops, { signal }),
        await this.#placeSigns(denops, { signal }),
        await this.#executeCommands(denops, { signal }),
      ];
      return results.some((result) => result) ? true : undefined;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const m = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to render content of the list component: ${m}`);
    }
  }

  async #renderWindow(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.info) return;
    if (!this.#modifiedWindow) return;
    this.#modifiedWindow = false;

    await this.update(denops, {
      title: this.#title ? ` ${this.#title} ` : undefined,
    });
    signal?.throwIfAborted();
  }

  async #renderContent(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.#modifiedContent || !this.info) return;
    this.#modifiedContent = false;

    const { bufnr, dimension: { width } } = this.info;
    const content = this.#items.map((v) => v.label);
    const decorations = this.#items
      .reduce((acc, v, i) => {
        const decorations = v.decorations
          .filter((d) => d.column < width)
          .map((d) => ({
            highlight: HIGHLIGHT_MATCH,
            ...d,
            line: i + 1,
          }));
        acc.push(...decorations);
        return acc;
      }, [] as Decoration[]);

    signal?.throwIfAborted();
    await buffer.replace(denops, bufnr, content);
    signal?.throwIfAborted();
    await buffer.undecorate(denops, bufnr);
    signal?.throwIfAborted();
    await buffer.decorate(denops, bufnr, decorations);

    return true;
  }

  async #placeSigns(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.#modifiedSigns || !this.info) return;
    this.#modifiedSigns = false;

    const { bufnr } = this.info;
    const selects = this.#items
      .map((v, i) => [v.id, i] as const)
      .filter(([id, _]) => id != null && this.#selection.has(id))
      .map(([_, i]) => i);

    signal?.throwIfAborted();
    await batch(denops, async (denops) => {
      // NOTE:
      // Vim require 'PopUp' prefix for sign group name in popup window
      await fn.sign_unplace(denops, SIGN_GROUP_SELECTED, {
        buffer: bufnr,
      });
      for (const i of selects) {
        await fn.sign_place(
          denops,
          0,
          SIGN_GROUP_SELECTED,
          SIGN_SELECTED,
          bufnr,
          { lnum: Math.max(1, i + 1) },
        );
      }
    });

    return true;
  }

  async #executeCommands(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.#reservedCommands.length || !this.info) return;
    const reservedCommands = this.#reservedCommands;
    this.#reservedCommands = [];

    const { winid } = this.info;

    signal?.throwIfAborted();
    await batch(denops, async (denops) => {
      for (const command of reservedCommands) {
        await fn.win_execute(denops, winid, command);
      }
    });

    return true;
  }
}
