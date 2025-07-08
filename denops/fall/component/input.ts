/**
 * @module component/input
 *
 * Input component for the vim-fall picker UI.
 *
 * This module provides the InputComponent class which manages the user input area
 * of the picker. It displays the current query, cursor position, collection/processing
 * status, and provides visual feedback through spinners and status indicators.
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import * as fn from "jsr:@denops/std@^7.3.2/function";
import * as buffer from "jsr:@denops/std@^7.3.2/buffer";
import type { Dimension } from "jsr:@vim-fall/core@^0.3.0/coordinator";

import { Spinner, UNICODE_SPINNER } from "../lib/spinner.ts";
import { adjustOffset } from "../lib/adjust_offset.ts";
import { getByteLength } from "../lib/stringutil.ts";
import { BaseComponent, type ComponentProperties } from "./_component.ts";

export const HIGHLIGHT_HEADER = "FallInputHeader";
export const HIGHLIGHT_CURSOR = "FallInputCursor";
export const HIGHLIGHT_COUNTER = "FallInputCounter";

const HEAD_SYMBOL = ">";
const FAIL_SYMBOL = "✕";
const SPINNER = UNICODE_SPINNER;

/**
 * Parameters for the InputComponent, extending ComponentProperties.
 * Includes properties specific to the input component like title, spinner, and symbols.
 */
export type InputComponentParams = ComponentProperties & {
  /** The title of the input component */
  readonly title?: string;

  /** The command line input text */
  readonly cmdline?: string;

  /** Optional spinner sequence to show during processing */
  readonly spinner?: readonly string[];

  /** Symbol to display at the start of the input line */
  readonly headSymbol?: string;

  /** Symbol to display when a failure occurs during input */
  readonly failSymbol?: string;
};

/**
 * The InputComponent class represents an interactive input component in the picker UI used for user input.
 *
 * It displays the current input state, including the input text, cursor position, and processing status.
 *
 * ```
 *    ┌ cmdline
 *    ┊  ┌ cmdpos
 * ╭──┊──┊───────────────────────────╮
 * │> QUE█Y                       0/0│
 * ╰┊─────────────────────────────┊─┊╯
 *  └ headSymbol                  ┊ └ collecting
 *                                └ processing
 *
 * ╭─────────────────────────────────╮
 * │⣾ QUE█Y                      0/0+│
 * ╰┊───────────────────────────────┊╯
 *  └ spinner                       └ truncated
 *
 * ╭─────────────────────────────────╮
 * │> QUE█Y                      0/0✕│
 * ╰────────────────────────────────┊╯
 *                                  └ failSymbol
 * ```
 */
export class InputComponent extends BaseComponent {
  readonly #spinner: Spinner;
  readonly #headSymbol: string;
  readonly #failSymbol: string;

  #title = "";
  #cmdline = "";
  #cmdpos = 0;
  #offset = 0;
  #collected = 0;
  #processed = 0;
  #truncated = false;
  #collecting: boolean | "failed" = false;
  #processing: boolean | "failed" = false;
  #modifiedWindow = true;
  #modifiedContent = true;

  // Cache for byte lengths to avoid repeated calculations
  #prefixCache?: { value: string; byteLength: number };
  #suffixCache?: { value: string; byteLength: number };

  constructor(
    {
      title,
      cmdline,
      spinner,
      headSymbol,
      failSymbol,
      ...params
    }: InputComponentParams = {},
  ) {
    super(params);
    this.#title = title ?? "";
    this.#cmdline = cmdline ?? "";
    this.#spinner = new Spinner(spinner ?? SPINNER);
    this.#headSymbol = headSymbol ?? HEAD_SYMBOL;
    this.#failSymbol = failSymbol ?? FAIL_SYMBOL;
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

  /** The current command line input */
  get cmdline(): string {
    return this.#cmdline;
  }

  /** Sets the command line input and marks the content as modified */
  set cmdline(value: string) {
    this.#cmdline = value;
    this.#modifiedContent = true;
  }

  /** The current cursor position in the command line */
  get cmdpos(): number {
    return this.#cmdpos;
  }

  /** Sets the cursor position in the command line */
  set cmdpos(value: number) {
    this.#cmdpos = value;
    this.#modifiedContent = true;
  }

  /** The number of items collected */
  get collected(): number {
    return this.#collected;
  }

  /** Sets the number of items collected and marks the content as modified */
  set collected(value: number) {
    this.#collected = value;
    this.#modifiedContent = true;
  }

  /** The number of items processed */
  get processed(): number {
    return this.#processed;
  }

  /** Sets the number of items processed and marks the content as modified */
  set processed(value: number) {
    this.#processed = value;
    this.#modifiedContent = true;
  }

  /** Indicates if the content is truncated */
  get truncated(): boolean {
    return this.#truncated;
  }

  /** Sets the truncated flag and marks the content as modified */
  set truncated(value: boolean) {
    this.#truncated = value;
    this.#modifiedContent = true;
  }

  /** The current collecting status, which can be a boolean or "failed" status */
  get collecting(): boolean | "failed" {
    return this.#collecting;
  }

  /** Sets the collecting status and marks the content as modified */
  set collecting(value: boolean | "failed") {
    this.#collecting = value;
    this.#modifiedContent = true;
  }

  /** The current processing status, which can be a boolean or "failed" status */
  get processing(): boolean | "failed" {
    return this.#processing;
  }

  /** Sets the processing status and marks the content as modified */
  set processing(value: boolean | "failed") {
    this.#processing = value;
    this.#modifiedContent = true;
  }

  get #prefix(): string {
    const head = this.processing
      ? this.processing === "failed" ? this.#failSymbol : this.#spinner.current
      : this.#headSymbol;
    return `${head} `;
  }

  get #suffix(): string {
    const mark = this.#truncated ? "+" : "";
    const tail = this.collecting
      ? this.collecting === "failed" ? this.#failSymbol : this.#spinner.current
      : "";
    return ` ${this.#processed}/${this.#collected}${mark} ${tail}`.trimEnd();
  }

  get #isSpinnerUpdated(): boolean {
    return (this.collecting || this.processing) && !this.#spinner.locked;
  }

  /**
   * Forces the component to re-render by marking both the window and content as modified
   */
  forceRender(): void {
    this.#modifiedWindow = true;
    this.#modifiedContent = true;
  }

  override async open(
    denops: Denops,
    dimension: Readonly<Dimension>,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<AsyncDisposable> {
    await using stack = new AsyncDisposableStack();
    stack.use(await super.open(denops, dimension, { signal }));
    signal?.throwIfAborted();
    await fn.win_execute(
      denops,
      this.info!.winid,
      "setlocal nocursorline signcolumn=no nowrap nolist nofoldenable nonumber norelativenumber filetype=fall-input",
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
        await this.#renderWindow(denops, { signal }),
        await this.#renderContent(denops, { signal }),
      ];
      return results.some((result) => result) ? true : undefined;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const m = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to render content of the input component: ${m}`);
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
    if (!this.info) return;
    if (!this.#modifiedContent && !this.#isSpinnerUpdated) return;
    this.#modifiedContent = false;

    const { bufnr, dimension: { width } } = this.info;

    const prefix = this.#prefix;
    const suffix = this.#suffix;
    const cmdwidth = width - prefix.length - suffix.length;

    this.#offset = adjustOffset(
      this.#offset,
      this.#cmdpos,
      this.#cmdline.length,
      cmdwidth - 1,
      2,
    );

    const spacer = " ".repeat(cmdwidth);
    const middle = `${this.#cmdline}${spacer}`.slice(
      this.#offset,
      this.#offset + cmdwidth,
    );

    // Use cached byte lengths when possible
    let prefixByteLength: number;
    if (this.#prefixCache?.value === prefix) {
      prefixByteLength = this.#prefixCache.byteLength;
    } else {
      prefixByteLength = getByteLength(prefix);
      this.#prefixCache = { value: prefix, byteLength: prefixByteLength };
    }

    const middleByteLength = getByteLength(middle);

    let suffixByteLength: number;
    if (this.#suffixCache?.value === suffix) {
      suffixByteLength = this.#suffixCache.byteLength;
    } else {
      suffixByteLength = getByteLength(suffix);
      this.#suffixCache = { value: suffix, byteLength: suffixByteLength };
    }

    await buffer.replace(denops, bufnr, [prefix + middle + suffix]);
    signal?.throwIfAborted();

    await buffer.undecorate(denops, bufnr);
    signal?.throwIfAborted();

    await buffer.decorate(denops, bufnr, [
      {
        line: 1,
        column: 1,
        length: prefixByteLength,
        highlight: HIGHLIGHT_HEADER,
      },
      {
        line: 1,
        column: Math.max(
          1,
          prefixByteLength + this.#cmdpos - this.#offset,
        ),
        length: 1,
        highlight: HIGHLIGHT_CURSOR,
      },
      {
        line: 1,
        column: 1 + prefixByteLength + middleByteLength,
        length: suffixByteLength,
        highlight: HIGHLIGHT_COUNTER,
      },
    ]);

    return true;
  }

  override async [Symbol.asyncDispose](): Promise<void> {
    await super[Symbol.asyncDispose]();
    this.#spinner[Symbol.dispose]();
  }
}
