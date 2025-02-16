import type { Denops } from "jsr:@denops/std@^7.3.2";
import * as fn from "jsr:@denops/std@^7.3.2/function";
import * as buffer from "jsr:@denops/std@^7.3.2/buffer";
import { batch } from "jsr:@denops/std@^7.3.2/batch";
import type { Dimension } from "jsr:@vim-fall/core@^0.3.0/coordinator";

import { BaseComponent, type ComponentProperties } from "./_component.ts";

/**
 * Parameters for configuring a PreviewComponent
 */
export type PreviewComponentParams = ComponentProperties & {
  /** If true, enables real syntax highlighting within the preview */
  readonly realHighlight?: boolean;
};

/**
 * Defines the structure of an item to be previewed
 */
export type PreviewItem = {
  /** Content to display in the preview as an array of strings */
  readonly content: readonly string[];
  /** Optional filename associated with the previewed content */
  readonly filename?: string;
  /** Optional filetype for applying syntax highlighting */
  readonly filetype?: string;
  /** Optional line number to position the cursor */
  readonly line?: number;
  /** Optional column number to position the cursor */
  readonly column?: number;
};

/**
 * Represents a preview component that displays content with optional
 * syntax highlighting and cursor positioning.
 */
export class PreviewComponent extends BaseComponent {
  readonly #realHighlight: boolean;
  #item?: PreviewItem;
  #modifiedContent = true;
  #reservedCommands: string[] = [];

  constructor({ realHighlight, ...params }: PreviewComponentParams = {}) {
    super(params);
    this.#realHighlight = realHighlight ?? false;
  }

  /** Gets the current preview item */
  get item(): PreviewItem | undefined {
    return this.#item;
  }

  /** Sets a new preview item, marking the content as modified */
  set item(value: PreviewItem | undefined) {
    this.#item = value;
    this.#modifiedContent = true;
  }

  /**
   * Adds a command to be executed in the preview window context.
   *
   * @param command - The Vim command to be executed
   */
  execute(command: string): void {
    this.#reservedCommands.push(command);
  }

  /** Forces a re-render of the preview content */
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
    await fn.win_execute(denops, winid, "setlocal signcolumn=no nofoldenable");
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
        await this.#executeCommands(denops, { signal }),
      ];
      return results.some((result) => result) ? true : undefined;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const m = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to render content of the preview component: ${m}`);
    }
  }

  async #renderContent(
    denops: Denops,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<true | void> {
    if (!this.#modifiedContent || !this.info) return;
    this.#modifiedContent = false;

    const { winid, bufnr } = this.info;

    const {
      content = ["No preview"],
      filename = "noname",
      filetype = "",
      line = 1,
      column = 1,
    } = this.#item ?? {};

    signal?.throwIfAborted();
    await buffer.replace(denops, bufnr, content as string[]);

    signal?.throwIfAborted();
    await batch(denops, async (denops) => {
      // Clear previous buffer context
      await fn.win_execute(
        denops,
        winid,
        `silent! 0file`,
      );
      await fn.win_execute(
        denops,
        winid,
        `silent! syntax clear`,
      );
      // Change buffer name and reset options
      await fn.win_execute(
        denops,
        winid,
        `silent! file fall://preview/${filename}`,
      );
      await fn.win_execute(
        denops,
        winid,
        `silent! setlocal winfixbuf winfixwidth winfixheight`,
      );
      // Apply highlight
      if (this.#realHighlight) {
        await fn.win_execute(
          denops,
          winid,
          `call fall#internal#highlight#real('${filetype}')`,
        );
      } else {
        await fn.win_execute(
          denops,
          winid,
          `call fall#internal#highlight#fast('${filetype}')`,
        );
      }
      // Overwrite buffer local options may configured by ftplugin
      await fn.win_execute(
        denops,
        winid,
        `silent! setlocal buftype=nofile bufhidden=wipe nobuflisted noswapfile nomodifiable nowrap cursorline cursorlineopt=number,line`,
      );
      // Move cursor
      await fn.win_execute(
        denops,
        winid,
        `silent! normal! ${line}G${column}|`,
      );
      // Emit autocmd for customization
      await fn.win_execute(
        denops,
        winid,
        `silent! doautocmd <nomodeline> User FallPreviewRendered:${filename}`,
      );
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
