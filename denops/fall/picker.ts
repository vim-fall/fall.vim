/**
 * @module picker
 *
 * Core picker implementation for vim-fall.
 *
 * This module provides the main `Picker` class which orchestrates the entire fuzzy finding
 * experience. It manages the lifecycle of a picker session including:
 *
 * - User input handling through the input component
 * - Item collection from sources
 * - Filtering items through matchers
 * - Sorting filtered results
 * - Rendering items in the list component
 * - Previewing selected items
 * - Managing user interactions and events
 *
 * The picker follows a pipeline architecture where items flow through:
 * Source -> Collector -> Matcher -> Sorter -> Renderer -> Preview
 *
 * Each stage can be customized with different implementations to create
 * various types of pickers (file finder, grep, buffer list, etc.).
 */

import type { Denops } from "jsr:@denops/std@^7.3.2";
import * as opt from "jsr:@denops/std@^7.3.2/option";
import * as autocmd from "jsr:@denops/std@^7.3.2/autocmd";
import * as lambda from "jsr:@denops/std@^7.3.2/lambda";
import { collect } from "jsr:@denops/std@^7.3.2/batch";
import { unreachable } from "jsr:@core/errorutil@^1.2.0/unreachable";
import type { Detail, IdItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type {
  Coordinator,
  Dimension,
  Size,
} from "jsr:@vim-fall/core@^0.3.0/coordinator";
import type { Source } from "jsr:@vim-fall/core@^0.3.0/source";
import type { Matcher } from "jsr:@vim-fall/core@^0.3.0/matcher";
import type { Sorter } from "jsr:@vim-fall/core@^0.3.0/sorter";
import type { Renderer } from "jsr:@vim-fall/core@^0.3.0/renderer";
import type { Previewer } from "jsr:@vim-fall/core@^0.3.0/previewer";
import type { Theme } from "jsr:@vim-fall/core@^0.3.0/theme";

import { Scheduler } from "./lib/scheduler.ts";
import { debounce } from "./lib/debounce.ts";
import { Cmdliner } from "./util/cmdliner.ts";
import { isIncrementalMatcher } from "./util/predicate.ts";
import { buildMappingHelpPages } from "./util/mapping.ts";
import {
  emitPickerEnterSystem,
  emitPickerLeaveSystem,
} from "./util/emitter.ts";
import { CollectProcessor } from "./processor/collect.ts";
import { MatchProcessor } from "./processor/match.ts";
import { SortProcessor } from "./processor/sort.ts";
import { RenderProcessor } from "./processor/render.ts";
import { PreviewProcessor } from "./processor/preview.ts";
import { InputComponent } from "./component/input.ts";
import { ListComponent } from "./component/list.ts";
import { PreviewComponent } from "./component/preview.ts";
import { HelpComponent } from "./component/help.ts";
import { consume, type Event } from "./event.ts";

const SCHEDULER_INTERVAL = 10;
const PREVIEW_DEBOUNCE_DELAY = 150;
const MATCHER_ICON = "🅼 ";
const SORTER_ICON = "🆂 ";
const RENDERER_ICON = "🆁 ";
const PREVIEWER_ICON = "🅿 ";

/**
 * Callback function type for reserved operations that need to be executed
 * asynchronously during the picker's main loop.
 */
type ReservedCallback = (
  denops: Denops,
  options: { signal?: AbortSignal },
) => void | Promise<void>;

/**
 * Configuration parameters for creating a new Picker instance.
 *
 * @template T - The type of detail data associated with each item
 */
export type PickerParams<T extends Detail> = {
  /** Unique name identifier for the picker */
  name: string;

  /** Visual theme configuration for the picker UI */
  theme: Theme;

  /** Layout coordinator that manages component positioning */
  coordinator: Coordinator;

  /** Source that provides items to the picker */
  source: Source<T>;

  /** Array of matchers for filtering items (at least one required) */
  matchers: readonly [Matcher<T>, ...Matcher<T>[]];

  /** Optional array of sorters for ordering filtered items */
  sorters?: readonly Sorter<T>[];

  /** Optional array of renderers for displaying items */
  renderers?: readonly Renderer<T>[];

  /** Optional array of previewers for showing item details */
  previewers?: readonly Previewer<T>[];

  /** Z-index for layering picker windows (default: 50) */
  zindex?: number;

  /** Optional context to restore previous picker state */
  context?: PickerContext<T>;
};

/**
 * Result returned when a picker session completes.
 *
 * @template T - The type of detail data associated with each item
 */
export type PickerResult<T extends Detail> = {
  /** The action name if an action was invoked (e.g., "edit", "split") */
  readonly action?: string;

  /** The final query string entered by the user */
  readonly query: string;

  /** The currently selected item, if any */
  readonly item: Readonly<IdItem<T>> | undefined;

  /** Array of multi-selected items, if any were selected */
  readonly selectedItems: Readonly<IdItem<T>>[] | undefined;

  /** All items that passed the current filter */
  readonly filteredItems: Readonly<IdItem<T>>[];
};

/**
 * Optional configuration for Picker behavior.
 */
export type PickerOptions = {
  /** Interval in milliseconds for the scheduler loop (default: 10) */
  schedulerInterval?: number;
  previewDebounceDelay?: number;
};

/**
 * Context state of a picker that can be saved and restored.
 * Useful for implementing picker resume functionality.
 *
 * @template T - The type of detail data associated with each item
 */
export type PickerContext<T extends Detail> = {
  /** The current query string */
  readonly query: string;

  /** Set of selected item IDs */
  readonly selection: Set<unknown>;

  /** All collected items from the source */
  readonly collectedItems: readonly IdItem<T>[];

  /** Items that passed the current filter */
  readonly filteredItems: readonly IdItem<T>[];

  /** Current cursor position in the list */
  readonly cursor: number;

  /** Current scroll offset in the list */
  readonly offset: number;

  /** Index of the active matcher */
  readonly matcherIndex: number;

  /** Index of the active sorter */
  readonly sorterIndex: number;

  /** Index of the active renderer */
  readonly rendererIndex: number;

  /** Index of the active previewer (if any) */
  readonly previewerIndex?: number;
};

/**
 * Main Picker class that orchestrates the fuzzy finding experience.
 *
 * The Picker manages the entire lifecycle of a fuzzy finding session, including:
 * - Creating and managing UI components (input, list, preview, help)
 * - Processing items through the collection -> match -> sort -> render pipeline
 * - Handling user interactions and keyboard events
 * - Managing component layout and resizing
 *
 * @template T - The type of detail data associated with each item
 *
 * @example
 * ```typescript
 * // Create a file picker
 * const picker = new Picker({
 *   name: "files",
 *   theme: MODERN_THEME,
 *   coordinator: modern(),
 *   source: file(),
 *   matchers: [fzf()],
 *   sorters: [alphabetical()],
 *   renderers: [nerdfont()],
 *   previewers: [file()],
 * });
 *
 * // Open and start the picker
 * await using _ = await picker.open(denops, { signal });
 * const result = await picker.start(denops, { args: [] });
 *
 * if (result?.item) {
 *   console.log("Selected:", result.item.value);
 * }
 * ```
 */
export class Picker<T extends Detail> implements AsyncDisposable {
  /** Number of z-index levels allocated for picker components */
  static readonly ZINDEX_ALLOCATION = 4;

  readonly #stack = new AsyncDisposableStack();
  readonly #schedulerInterval: number;
  readonly #previewDebounceDelay: number;
  readonly #name: string;
  readonly #coordinator: Coordinator;
  readonly #collectProcessor: CollectProcessor<T>;
  readonly #matchProcessor: MatchProcessor<T>;
  readonly #sortProcessor: SortProcessor<T>;
  readonly #renderProcessor: RenderProcessor<T>;
  readonly #previewProcessor?: PreviewProcessor<T>;
  readonly #inputComponent: InputComponent;
  readonly #listComponent: ListComponent;
  readonly #previewComponent?: PreviewComponent;
  readonly #helpComponent: HelpComponent;
  readonly #helpWidthRatio = 0.98;
  readonly #helpHeightRatio = 0.3;
  readonly #matcherIcon: string;
  readonly #sorterIcon: string;
  readonly #rendererIcon: string;
  readonly #previewerIcon: string;
  #selection: Set<unknown>;

  /**
   * Creates a new Picker instance.
   *
   * @param params - Configuration parameters for the picker
   * @param options - Optional behavior configuration
   */
  constructor(params: PickerParams<T>, options: PickerOptions = {}) {
    this.#schedulerInterval = options.schedulerInterval ?? SCHEDULER_INTERVAL;
    this.#previewDebounceDelay = options.previewDebounceDelay ??
      PREVIEW_DEBOUNCE_DELAY;

    const { name, theme, coordinator, zindex = 50, context } = params;
    this.#name = name;
    this.#coordinator = coordinator;
    this.#selection = context?.selection ?? new Set();

    // Components
    this.#matcherIcon = theme.matcherIcon ?? MATCHER_ICON;
    this.#sorterIcon = theme.sorterIcon ?? SORTER_ICON;
    this.#rendererIcon = theme.rendererIcon ?? RENDERER_ICON;
    this.#previewerIcon = theme.previewerIcon ?? PREVIEWER_ICON;

    const style = this.#coordinator.style(theme);
    this.#inputComponent = this.#stack.use(
      new InputComponent({
        cmdline: context?.query ?? "",
        spinner: theme.spinner,
        headSymbol: theme.headSymbol,
        failSymbol: theme.failSymbol,
        border: style.input,
        title: this.#name,
        zindex,
      }),
    );
    this.#listComponent = this.#stack.use(
      new ListComponent({
        border: style.list,
        zindex: zindex + 1,
      }),
    );
    if (style.preview) {
      this.#previewComponent = this.#stack.use(
        new PreviewComponent({
          border: style.preview,
          zindex: zindex + 2,
        }),
      );
    }
    this.#helpComponent = this.#stack.use(
      new HelpComponent({
        title: " Help ",
        border: theme.border,
        zindex: zindex + 3,
      }),
    );

    // Processor
    this.#collectProcessor = this.#stack.use(
      new CollectProcessor(params.source, {
        initialItems: context?.collectedItems,
      }),
    );
    this.#matchProcessor = this.#stack.use(
      new MatchProcessor(params.matchers, {
        initialItems: context?.filteredItems,
        initialQuery: context?.query,
        initialIndex: context?.matcherIndex,
        // Use incremental mode for Curator matcher
        incremental: isIncrementalMatcher(params.matchers[0]),
      }),
    );
    this.#sortProcessor = this.#stack.use(
      new SortProcessor(params.sorters ?? [], {
        // initialItems: this.#matchProcessor.items,
        initialIndex: context?.sorterIndex,
      }),
    );
    this.#renderProcessor = this.#stack.use(
      new RenderProcessor(params.renderers ?? [], {
        // initialItems: session?.renderedItems,
        initialIndex: context?.rendererIndex,
        initialCursor: context?.cursor,
        initialOffset: context?.offset,
      }),
    );
    this.#previewProcessor = this.#stack.use(
      new PreviewProcessor(params.previewers ?? [], {
        initialIndex: context?.previewerIndex,
      }),
    );
  }

  /**
   * Gets the current context state of the picker.
   *
   * This context can be used to save and restore the picker state,
   * enabling features like picker resume.
   *
   * @returns The current picker context
   */
  get context(): PickerContext<T> {
    return {
      query: this.#inputComponent.cmdline,
      selection: this.#selection,
      collectedItems: this.#collectProcessor.items,
      filteredItems: this.#matchProcessor.items,
      cursor: this.#renderProcessor.cursor,
      offset: this.#renderProcessor.offset,
      matcherIndex: this.#matchProcessor.matcherIndex,
      sorterIndex: this.#sortProcessor.sorterIndex,
      rendererIndex: this.#renderProcessor.rendererIndex,
    };
  }

  #getHelpDimension(screen: Size): Dimension {
    const width = Math.floor(screen.width * this.#helpWidthRatio);
    const height = Math.floor(screen.height * this.#helpHeightRatio);
    const row = Math.floor(screen.height - height - 2);
    const col = Math.floor((screen.width - width) / 2);
    return { row, col, width, height };
  }

  #getExtensionIndicator(): string {
    const { matcherIndex, matcherCount } = this.#matchProcessor;
    const { sorterIndex, sorterCount } = this.#sortProcessor;
    const { rendererIndex, rendererCount } = this.#renderProcessor;
    const { previewerIndex, previewerCount } = this.#previewProcessor ?? {};
    const mi = matcherCount > 1
      ? `${this.#matcherIcon}${matcherIndex + 1}`
      : "";
    const si = sorterCount > 1 ? `${this.#sorterIcon}${sorterIndex + 1}` : "";
    const ri = rendererCount > 1
      ? `${this.#rendererIcon}${rendererIndex + 1}`
      : "";
    const pi = previewerIndex !== undefined && previewerCount !== undefined &&
        previewerCount > 1
      ? `${this.#previewerIcon}${previewerIndex + 1}`
      : "";
    return `${mi} ${si} ${ri} ${pi}`.trim();
  }

  /**
   * Opens the picker UI components and prepares them for interaction.
   *
   * This method:
   * - Creates and positions all UI windows (input, list, preview)
   * - Sets up window resize handlers
   * - Emits picker enter/leave events
   *
   * The returned AsyncDisposable should be used with `await using` to ensure
   * proper cleanup when the picker closes.
   *
   * @param denops - The Denops instance
   * @param options - Options including an optional AbortSignal
   * @returns An AsyncDisposable for cleanup
   *
   * @example
   * ```typescript
   * await using _ = await picker.open(denops, { signal });
   * // Picker is now open and ready for use
   * ```
   */
  async open(
    denops: Denops,
    { signal }: { signal?: AbortSignal },
  ): Promise<AsyncDisposable> {
    await using stack = new AsyncDisposableStack();

    // Calculate dimensions
    const screen = await getScreenSize(denops);
    const layout = this.#coordinator.layout(screen);
    stack.use(
      await this.#inputComponent.open(
        denops,
        layout.input,
        { signal },
      ),
    );
    stack.use(
      await this.#listComponent.open(
        denops,
        layout.list,
        { signal },
      ),
    );
    if (this.#previewComponent && layout.preview) {
      stack.use(
        await this.#previewComponent.open(
          denops,
          layout.preview,
          { signal },
        ),
      );
    }
    this.#renderProcessor.height = layout.list.height;

    // Register autocmd to resize components
    const resizeComponents = stack.use(lambda.add(denops, async () => {
      const screen = await getScreenSize(denops);
      const layout = this.#coordinator.layout(screen);
      const helpDimension = this.#getHelpDimension(screen);
      await this.#inputComponent.move(
        denops,
        layout.input,
        { signal },
      );
      await this.#listComponent.move(
        denops,
        layout.list,
        { signal },
      );
      if (this.#previewComponent && layout.preview) {
        await this.#previewComponent?.move(
          denops,
          layout.preview,
          { signal },
        );
      }
      await this.#helpComponent.move(
        denops,
        helpDimension,
        { signal },
      );
      if (this.#helpComponent.info) {
        // Regenerate help pages
        this.#helpComponent.pages = await buildMappingHelpPages(
          denops,
          helpDimension.width,
          helpDimension.height - 1,
        );
      }
      this.#inputComponent.forceRender();
      this.#listComponent.forceRender();
      this.#previewComponent?.forceRender();
      this.#helpComponent.forceRender();
      this.#renderProcessor.height = layout.list.height;
    }));
    const autocmdGroupName = `fall-picker-${this.#name}-${resizeComponents.id}`;
    stack.defer(async () => {
      await autocmd.remove(denops, "VimResized", "*", {
        group: autocmdGroupName,
      });
    });
    await autocmd.group(
      denops,
      autocmdGroupName,
      (helper) => {
        helper.remove("*");
        helper.define("VimResized", "*", `call ${resizeComponents.notify()}`);
      },
    );

    // Emit 'FallPickerEnterSystem/FallPickerLeaveSystem' autocmd
    stack.defer(async () => {
      await emitPickerLeaveSystem(denops, this.#name);
    });
    await emitPickerEnterSystem(denops, this.#name);

    return stack.move();
  }

  /**
   * Starts the picker interaction loop.
   *
   * This method:
   * - Begins collecting items from the source
   * - Starts the main event loop to handle user input
   * - Processes items through the pipeline (match, sort, render)
   * - Returns when the user accepts or cancels
   *
   * @param denops - The Denops instance
   * @param params - Parameters including source arguments
   * @param options - Options including an optional AbortSignal
   * @returns The picker result if accepted, undefined if cancelled
   *
   * @example
   * ```typescript
   * const result = await picker.start(denops, { args: ["--hidden"] });
   * if (result) {
   *   console.log("Selected:", result.item?.value);
   *   console.log("Action:", result.action);
   * }
   * ```
   */
  async start(
    denops: Denops,
    { args }: { args: readonly string[] },
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<PickerResult<T> | undefined> {
    await using stack = new AsyncDisposableStack();

    this.#collectProcessor.start(denops, { args });
    stack.defer(() => this.#collectProcessor.pause());

    // Change window title
    if (args.length > 0) {
      this.#inputComponent.title = `${this.#name}:${args.join(" ")}`;
    }
    this.#listComponent.title = this.#getExtensionIndicator();

    // Start mainloop
    let action: string | undefined;
    const accept = async (name: string) => {
      await Cmdliner.accept(denops);
      action = name;
    };
    let reservedCallbacks: ReservedCallback[] = [];
    const reserve = (callback: ReservedCallback) => {
      reservedCallbacks.push(callback);
    };
    const reservePreviewDebounced = debounce(reserve, {
      delay: this.#previewDebounceDelay,
      signal,
    });
    const cmdliner = new Cmdliner({
      cmdline: this.#inputComponent.cmdline,
      cmdpos: this.#inputComponent.cmdpos,
    });
    const scheduler = stack.use(new Scheduler(this.#schedulerInterval));
    const waiter = scheduler.start(async () => {
      // Check cmdline/cmdpos
      await cmdliner.check(denops);

      // Handle events synchronously
      consume((event) =>
        this.#handleEvent(event, {
          accept,
          reserve,
          reservePreviewDebounced,
        })
      );

      // Handle reserved callbacks asynchronously
      for (const callback of reservedCallbacks) {
        await callback(denops, { signal });
      }
      reservedCallbacks = [];

      // Render components
      const renderResults = [
        await this.#inputComponent.render(denops, { signal }),
        await this.#listComponent.render(denops, { signal }),
        await this.#previewComponent?.render(denops, { signal }),
        await this.#helpComponent.render(denops, { signal }),
      ];
      if (renderResults.some((result) => result === true)) {
        await denops.cmd("redraw");
      }
    }, { signal });

    stack.defer(() => Cmdliner.cancel(denops));
    const query = await Promise.race([
      cmdliner.input(denops, { signal }),
      waiter,
    ]);
    if (query == null) {
      return;
    }

    const item = this.#matchProcessor.items[this.#renderProcessor.cursor];
    const selectedItems = this.#selection.size > 0
      ? this.#matchProcessor.items.filter((v) => this.#selection.has(v.id))
      : undefined;
    return {
      action,
      query,
      item,
      selectedItems,
      filteredItems: this.#matchProcessor.items,
    };
  }

  /**
   * Handles item selection at the specified cursor position.
   *
   * @param cursor - The cursor position or "$" for last item
   * @param method - Selection method: "on" to select, "off" to deselect, "toggle" to toggle
   */
  #select(
    cursor?: number | "$",
    method: "on" | "off" | "toggle" = "toggle",
  ): void {
    if (cursor === "$") {
      cursor = this.#matchProcessor.items.length - 1;
    }
    if (cursor === undefined) {
      cursor = this.#renderProcessor.cursor;
    }
    const item = this.#matchProcessor.items.at(cursor);
    if (!item) {
      return;
    }
    switch (method) {
      case "on":
        this.#selection.add(item.id);
        break;
      case "off":
        this.#selection.delete(item.id);
        break;
      case "toggle":
        if (this.#selection.has(item.id)) {
          this.#selection.delete(item.id);
        } else {
          this.#selection.add(item.id);
        }
        break;
      default:
        unreachable(method);
    }
  }

  /**
   * Handles selection of all filtered items.
   *
   * @param method - Selection method: "on" to select all, "off" to deselect all, "toggle" to toggle all
   */
  #selectAll(
    method: "on" | "off" | "toggle" = "toggle",
  ): void {
    switch (method) {
      case "on":
        this.#selection = new Set(this.#matchProcessor.items.map((v) => v.id));
        break;
      case "off":
        this.#selection = new Set();
        break;
      case "toggle": {
        const isSelected = this.#selection.has.bind(this.#selection);
        this.#matchProcessor.items.forEach((v) => {
          if (isSelected(v.id)) {
            this.#selection.delete(v.id);
          } else {
            this.#selection.add(v.id);
          }
        });
        break;
      }
      default:
        unreachable(method);
    }
  }

  /**
   * Central event handler for all picker events.
   *
   * This method processes events from:
   * - User input (keyboard/commands)
   * - Component updates
   * - Processor state changes
   *
   * Events may trigger immediate actions or reserve callbacks for
   * asynchronous processing in the next scheduler tick.
   *
   * @param event - The event to handle
   * @param handlers - Accept and reserve callback handlers
   */
  #handleEvent(event: Event, { accept, reserve, reservePreviewDebounced }: {
    accept: (name: string) => Promise<void>;
    reserve: (callback: ReservedCallback) => void;
    reservePreviewDebounced: (callback: ReservedCallback) => void;
  }): void {
    switch (event.type) {
      case "vim-cmdline-changed":
        this.#inputComponent.cmdline = event.cmdline;
        reserve((denops) => {
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: event.cmdline,
          }, {
            restart: true,
          });
        });
        break;
      case "vim-cmdpos-changed":
        this.#inputComponent.cmdpos = event.cmdpos;
        break;
      case "move-cursor": {
        const amplifier = event.scroll ? this.#listComponent.scroll : 1;
        this.#renderProcessor.cursor += event.amount * amplifier;
        reserve((denops) => {
          this.#renderProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      }
      case "move-cursor-at":
        this.#renderProcessor.cursor = event.cursor;
        reserve((denops) => {
          this.#renderProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      case "select-item":
        this.#select(event.cursor, event.method);
        this.#listComponent.selection = this.#selection;
        break;
      case "select-all-items":
        this.#selectAll(event.method);
        this.#listComponent.selection = this.#selection;
        break;
      case "switch-matcher": {
        let index = this.#matchProcessor.matcherIndex + event.amount;
        if (event.cycle) {
          if (index < 0) {
            index = this.#matchProcessor.matcherCount - 1;
          } else if (index >= this.#matchProcessor.matcherCount) {
            index = 0;
          }
        }
        this.#matchProcessor.matcherIndex = index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          }, {
            restart: true,
          });
        });
        break;
      }
      case "switch-matcher-at":
        this.#matchProcessor.matcherIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          }, {
            restart: true,
          });
        });
        break;
      case "switch-sorter": {
        let index = this.#sortProcessor.sorterIndex + event.amount;
        if (event.cycle) {
          if (index < 0) {
            index = this.#sortProcessor.sorterCount - 1;
          } else if (index >= this.#sortProcessor.sorterCount) {
            index = 0;
          }
        }
        this.#sortProcessor.sorterIndex = index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // Restart the sort processor with items from the match processor
          this.#sortProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      }
      case "switch-sorter-at":
        this.#sortProcessor.sorterIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // Restart the sort processor with items from the match processor
          this.#sortProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      case "switch-renderer": {
        let index = this.#renderProcessor.rendererIndex + event.amount;
        if (event.cycle) {
          if (index < 0) {
            index = this.#renderProcessor.rendererCount - 1;
          } else if (index >= this.#renderProcessor.rendererCount) {
            index = 0;
          }
        }
        this.#renderProcessor.rendererIndex = index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // Restart the render processor with items from the sort processor
          this.#renderProcessor.start(denops, {
            items: this.#sortProcessor.items,
          });
        });
        break;
      }
      case "switch-renderer-at":
        this.#renderProcessor.rendererIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // Restart the render processor with items from the sort processor
          this.#renderProcessor.start(denops, {
            items: this.#sortProcessor.items,
          });
        });
        break;
      case "switch-previewer": {
        if (!this.#previewProcessor) break;
        let index = this.#previewProcessor.previewerIndex + event.amount;
        if (event.cycle) {
          if (index < 0) {
            index = this.#previewProcessor.previewerCount - 1;
          } else if (index >= this.#previewProcessor.previewerCount) {
            index = 0;
          }
        }
        this.#previewProcessor.previewerIndex = index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reservePreviewDebounced((denops) => {
          this.#previewProcessor?.start(denops, {
            item: this.#matchProcessor.items[this.#renderProcessor.cursor],
          });
        });
        break;
      }
      case "switch-previewer-at":
        if (!this.#previewProcessor) break;
        this.#previewProcessor.previewerIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reservePreviewDebounced((denops) => {
          this.#previewProcessor?.start(denops, {
            item: this.#matchProcessor.items[this.#renderProcessor.cursor],
          });
        });
        break;
      case "action-invoke":
        accept(event.name);
        break;
      case "list-component-execute":
        this.#listComponent.execute(event.command);
        break;
      case "preview-component-execute":
        this.#previewComponent?.execute(event.command);
        break;
      case "help-component-toggle":
        if (this.#helpComponent.info) {
          this.#helpComponent.close();
          reserve(async (denops) => {
            await denops.cmd("redraw");
          });
        } else {
          reserve(async (denops, { signal }) => {
            const screen = await getScreenSize(denops);
            const helpDimension = this.#getHelpDimension(screen);
            this.#helpComponent.pages = await buildMappingHelpPages(
              denops,
              helpDimension.width,
              helpDimension.height - 1,
            );
            this.#helpComponent.open(
              denops,
              helpDimension,
              { signal },
            );
          });
        }
        break;
      case "help-component-page":
        this.#helpComponent.page += event.amount;
        break;
      case "collect-processor-started":
        this.#inputComponent.collecting = true;
        break;
      case "collect-processor-updated":
        this.#inputComponent.collected = this.#collectProcessor.items.length;
        reserve((denops) => {
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          });
        });
        break;
      case "collect-processor-succeeded":
        this.#inputComponent.collecting = false;
        reserve((denops) => {
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          });
        });
        break;
      case "collect-processor-failed": {
        if (event.err === null) {
          break;
        }
        this.#inputComponent.collecting = "failed";
        console.warn(`[fall] Failed to collect items:`, event.err);
        break;
      }
      case "match-processor-started":
        this.#inputComponent.processing = true;
        break;
      case "match-processor-updated":
        this.#inputComponent.processed = this.#matchProcessor.items.length;
        reserve((denops) => {
          this.#sortProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      case "match-processor-succeeded":
        this.#inputComponent.processing = false;
        this.#inputComponent.processed = this.#matchProcessor.items.length;
        reserve((denops) => {
          this.#sortProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      case "match-processor-failed": {
        if (event.err === null) {
          break;
        }
        this.#inputComponent.processing = "failed";
        console.warn(`[fall] Failed to filter items:`, event.err);
        break;
      }
      case "sort-processor-started":
        break;
      case "sort-processor-succeeded": {
        reserve((denops) => {
          this.#renderProcessor.start(denops, {
            items: this.#sortProcessor.items,
          });
        });
        break;
      }
      case "sort-processor-failed": {
        this.#inputComponent.processing = "failed";
        if (event.err === null) {
          break;
        }
        console.warn(`[fall] Failed to sort items:`, event.err);
        // Even if sorting failed, try to render items
        reserve((denops) => {
          this.#renderProcessor.start(denops, {
            items: this.#matchProcessor.items,
          });
        });
        break;
      }
      case "render-processor-started":
        break;
      case "render-processor-succeeded": {
        const line = this.#renderProcessor.line;
        this.#listComponent.items = this.#renderProcessor.items;
        this.#listComponent.execute(`silent! normal! ${line}G`);
        reservePreviewDebounced((denops) => {
          this.#previewProcessor?.start(denops, {
            item: this.#matchProcessor.items[this.#renderProcessor.cursor],
          });
        });
        break;
      }
      case "render-processor-failed": {
        this.#inputComponent.processing = "failed";
        if (event.err === null) {
          break;
        }
        console.warn(`[fall] Failed to render items:`, event.err);
        break;
      }
      case "preview-processor-started":
        break;
      case "preview-processor-succeeded":
        if (this.#previewComponent && this.#previewProcessor) {
          this.#previewComponent.item = this.#previewProcessor.item;
        }
        break;
      case "preview-processor-failed": {
        this.#inputComponent.processing = "failed";
        if (event.err === null) {
          break;
        }
        console.warn(`[fall] Failed to preview an item:`, event.err);
        break;
      }
      default:
        unreachable(event);
    }
  }

  /**
   * Async disposal method for cleaning up picker resources.
   *
   * This is called automatically when using `await using` syntax.
   * It ensures all components and processors are properly disposed.
   */
  [Symbol.asyncDispose]() {
    return this.#stack[Symbol.asyncDispose]();
  }
}

/**
 * Gets the current screen size from Vim.
 *
 * @param denops - The Denops instance
 * @returns The screen dimensions
 */
async function getScreenSize(denops: Denops): Promise<Size> {
  const [width, height] = await collect(denops, (denops) => [
    opt.columns.get(denops),
    opt.lines.get(denops),
  ]);
  return { width, height };
}
