/**
 * @module component/help
 *
 * Help component for the vim-fall picker UI.
 *
 * This module provides the HelpComponent class which displays interactive help
 * information to users. It supports:
 *
 * - Multi-page help content with navigation
 * - Syntax highlighting through decorations
 * - Dynamic content generation based on current mappings
 * - Toggle visibility with F1 key
 *
 * The help component provides contextual assistance, showing available
 * keyboard shortcuts and commands for the current picker.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Decoration } from "jsr:@denops/std@^7.3.2/buffer";
import * as mapping from "jsr:@denops/std@^7.3.2/mapping";
import * as fn from "jsr:@denops/std@^7.3.2/function";
import * as buffer from "jsr:@denops/std@^7.3.2/buffer";
import type { Dimension } from "jsr:@vim-fall/core@^0.3.0/coordinator";

import { BaseComponent } from "./_component.ts";
import { ItemBelt } from "../lib/item_belt.ts";

/**
 * Represents a page in the HelpComponent.
 * Contains content and optional decorations for the page.
 */
export type Page = {
  /** The content to be displayed on the page */
  readonly content: readonly string[];

  /** The decorations to be applied on the page (optional) */
  readonly decorations?: readonly Decoration[];
};

/**
 * A component to display help content, extendable for navigation, rendering, and updating pages.
 */
export class HelpComponent extends BaseComponent {
  readonly #pages = new ItemBelt<Page>([]);
  #modifiedContent = true;

  /**
   * Returns the current page number (1-based).
   */
  get page(): number {
    return this.#pages.index + 1;
  }

  /**
   * Sets the page number or sets it to the last page ("$").
   * @param page - The page number to set or "$" to set to the last page.
   */
  set page(page: number | "$") {
    if (page === "$") {
      page = this.#pages.count;
    }
    this.#pages.index = page - 1;
    this.#modifiedContent = true;
  }

  /**
   * Returns the list of all pages.
   */
  get pages(): readonly Page[] {
    return this.#pages.items;
  }

  /**
   * Sets the list of pages and marks the content as modified.
   * @param pages - An array of pages to set.
   */
  set pages(pages: readonly Page[]) {
    this.#pages.items = pages;
    this.#modifiedContent = true;
  }

  /**
   * Forces the component to re-render by marking the content as modified.
   */
  forceRender(): void {
    this.#modifiedContent = true;
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
      "setlocal nocursorline signcolumn=no nowrap nolist nofoldenable nonumber norelativenumber filetype=fall-help",
    );

    this.forceRender();
    return stack.move();
  }

  override async render(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    try {
      const results = [
        await this.#renderContent(denops, { signal }),
      ];
      return results.some((result) => result) ? true : undefined;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const m = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to render content of the list component: ${m}`);
    }
  }

  async #renderContent(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.#modifiedContent || !this.info) return;
    this.#modifiedContent = false;

    const { bufnr, dimension: { width } } = this.info;

    const page = this.#pages.current;
    const content = [
      await this.#buildNavigationHeader(denops, width, { signal }),
      ...(page?.content ?? []),
    ];
    const decorations = [
      {
        line: 1,
        column: 1,
        length: width,
        highlight: "FallHelpHeader",
      },
      ...(page?.decorations ?? []).map((d) => ({
        ...d,
        line: d.line + 1,
      })),
    ];

    signal?.throwIfAborted();
    await buffer.replace(denops, bufnr, content);
    signal?.throwIfAborted();
    await buffer.undecorate(denops, bufnr);
    signal?.throwIfAborted();
    await buffer.decorate(denops, bufnr, decorations);

    return true;
  }

  async #buildNavigationHeader(
    denops: Denops,
    width: number,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<string> {
    const mappings = await mapping.list(denops, "", { mode: "c" });
    signal?.throwIfAborted();
    const prev = mappings.find((m) => m.rhs === "<Plug>(fall-help-prev)");
    const next = mappings.find((m) => m.rhs === "<Plug>(fall-help-next)");
    const navigator = [prev?.lhs, next?.lhs].filter((v) => !!v).join(" / ");
    const pager = `Page ${this.page}/${this.#pages.count}`;
    const spacer = " ".repeat(width - pager.length - navigator.length);
    return `${pager}${spacer}${navigator}`;
  }
}
