import type { Denops } from "@denops/std";
import * as popup from "@denops/std/popup";
import type { Border } from "@vim-fall/core/theme";
import type { Dimension } from "@vim-fall/core/coordinator";

const HIGHLIGHT_NORMAL = "FallNormal";
const HIHGLIGHT_BORDER = "FallBorder";

/**
 * Properties that define the appearance and behavior of a component.
 */
export type ComponentProperties = {
  /** The title of the component */
  readonly title?: string;

  /** The border style for the component */
  readonly border?: Border;

  /** The z-index of the component */
  readonly zindex?: number;
};

/**
 * Information about the component's current state, including window ID and buffer number.
 */
export type ComponentInfo = {
  /** The buffer number associated with the component */
  readonly bufnr: number;

  /** The window ID associated with the component */
  readonly winid: number;

  /** The dimension (size and position) of the component */
  readonly dimension: Readonly<Dimension>;
};

/**
 * Options for interacting with the component, such as abort signals.
 */
export type ComponentOptions = {
  /** Signal used to abort operations */
  signal?: AbortSignal;
};

/**
 * The base interface for a component that can be opened, moved, updated, rendered, and closed.
 * Provides methods to manipulate the component's window and update its properties.
 */
export type Component = AsyncDisposable & {
  /**
   * Opens the component window with the specified dimensions.
   * @param denops The Denops instance.
   * @param dimension The dimensions of the component.
   * @param options Additional options such as the abort signal.
   * @returns A disposable object to manage the component window's lifecycle.
   */
  open(
    denops: Denops,
    dimension: Readonly<Dimension>,
    options?: ComponentOptions,
  ): Promise<AsyncDisposable>;

  /**
   * Moves the component window to new dimensions.
   * @param denops The Denops instance.
   * @param dimension The new dimensions of the component.
   * @param options Additional options such as the abort signal.
   */
  move(
    denops: Denops,
    dimension: Readonly<Partial<Dimension>>,
    options?: ComponentOptions,
  ): Promise<void>;

  /**
   * Updates the component's properties.
   * @param denops The Denops instance.
   * @param properties The new properties of the component.
   * @param options Additional options such as the abort signal.
   */
  update(
    denops: Denops,
    properties: Readonly<ComponentProperties>,
    options?: ComponentOptions,
  ): Promise<void>;

  /**
   * Renders the component.
   * @param denops The Denops instance.
   * @param options Additional options such as the abort signal.
   * @returns A promise that resolves to `true` or `void` when rendering is complete.
   *        If the component does not need to render anything, it can resolve with `void`.
   */
  render(
    denops: Denops,
    options?: ComponentOptions,
  ): Promise<true | void>;

  /**
   * Closes the component.
   */
  close(): Promise<void>;
};

/**
 * A base class for a component that can be opened, moved, updated, rendered, and closed.
 * This class uses the `popup` module to manage the window and display the component.
 */
export class BaseComponent implements Component {
  #opened?: {
    readonly window: popup.PopupWindow;
    readonly dimension: Readonly<Dimension>;
  };

  protected properties: Readonly<ComponentProperties>;

  constructor(properties: Readonly<ComponentProperties> = {}) {
    this.properties = properties;
  }

  /**
   * Returns information about the component's current state (buffer number, window ID, and dimensions).
   * If the component is not opened, returns `undefined`.
   */
  get info(): Readonly<ComponentInfo> | undefined {
    if (!this.#opened) {
      return undefined;
    }
    const { bufnr, winid } = this.#opened.window;
    return { bufnr, winid, dimension: this.#opened.dimension };
  }

  async open(
    denops: Denops,
    dimension: Readonly<Dimension>,
    { signal }: ComponentOptions = {},
  ): Promise<AsyncDisposable> {
    if (this.#opened) {
      return this;
    }
    signal?.throwIfAborted();
    this.#opened = {
      window: await popup.open(denops, {
        ...dimension,
        ...this.properties,
        relative: "editor",
        anchor: "NW",
        highlight: {
          normal: HIGHLIGHT_NORMAL,
          border: HIHGLIGHT_BORDER,
        },
        noRedraw: true,
      }),
      dimension,
    };
    return this;
  }

  async move(
    denops: Denops,
    dimension: Readonly<Partial<Dimension>>,
    { signal }: ComponentOptions = {},
  ): Promise<void> {
    if (this.#opened) {
      this.#opened = {
        ...this.#opened,
        dimension: {
          ...this.#opened.dimension,
          ...dimension,
        },
      };
      signal?.throwIfAborted();
      await popup.config(denops, this.#opened.window.winid, {
        ...dimension,
        relative: "editor",
        noRedraw: true,
      });
    }
  }

  async update(
    denops: Denops,
    properties: Readonly<ComponentProperties>,
    { signal }: ComponentOptions = {},
  ): Promise<void> {
    this.properties = {
      ...this.properties,
      ...properties,
    };
    if (this.#opened) {
      signal?.throwIfAborted();
      await popup.config(denops, this.#opened.window.winid, {
        ...properties,
        noRedraw: true,
      });
    }
  }

  render(
    _denops: Denops,
    _options: ComponentOptions = {},
  ): Promise<true | void> {
    return Promise.resolve(true);
  }

  async close(): Promise<void> {
    await this.#opened?.window.close();
    this.#opened = undefined;
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
