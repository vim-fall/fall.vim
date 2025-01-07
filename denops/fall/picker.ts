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
const MATCHER_ICON = "🅼 ";
const SORTER_ICON = "🆂 ";
const RENDERER_ICON = "🆁 ";
const PREVIEWER_ICON = "🅿 ";

type ReservedCallback = (
  denops: Denops,
  options: { signal?: AbortSignal },
) => void | Promise<void>;

export type PickerParams<T extends Detail> = {
  name: string;
  theme: Theme;
  coordinator: Coordinator;
  source: Source<T>;
  matchers: readonly [Matcher<T>, ...Matcher<T>[]];
  sorters?: readonly Sorter<T>[];
  renderers?: readonly Renderer<T>[];
  previewers?: readonly Previewer<T>[];
  zindex?: number;
};

export type PickerResult<T extends Detail> = {
  readonly action?: string;
  readonly query: string;
  readonly item: Readonly<IdItem<T>> | undefined;
  readonly selectedItems: Readonly<IdItem<T>>[] | undefined;
  readonly filteredItems: Readonly<IdItem<T>>[];
};

export type PickerOptions = {
  schedulerInterval?: number;
};

export class Picker<T extends Detail> implements AsyncDisposable {
  static readonly ZINDEX_ALLOCATION = 4;
  readonly #stack = new AsyncDisposableStack();
  readonly #schedulerInterval: number;
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
  #selection: Set<unknown> = new Set();

  constructor(params: PickerParams<T>, options: PickerOptions = {}) {
    this.#schedulerInterval = options.schedulerInterval ?? SCHEDULER_INTERVAL;
    this.#name = params.name;
    this.#coordinator = params.coordinator;

    // Components
    const { theme, zindex = 50 } = params;
    this.#matcherIcon = theme.matcherIcon ?? MATCHER_ICON;
    this.#sorterIcon = theme.sorterIcon ?? SORTER_ICON;
    this.#rendererIcon = theme.rendererIcon ?? RENDERER_ICON;
    this.#previewerIcon = theme.previewerIcon ?? PREVIEWER_ICON;

    const style = this.#coordinator.style(theme);
    this.#inputComponent = this.#stack.use(
      new InputComponent({
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
      new CollectProcessor(params.source),
    );
    this.#matchProcessor = this.#stack.use(
      new MatchProcessor(params.matchers, {
        // Use incremental mode for Curator matcher
        incremental: isIncrementalMatcher(params.matchers[0]),
      }),
    );
    this.#sortProcessor = this.#stack.use(
      new SortProcessor(params.sorters ?? []),
    );
    this.#renderProcessor = this.#stack.use(
      new RenderProcessor(
        params.renderers ?? [],
      ),
    );
    this.#previewProcessor = this.#stack.use(
      new PreviewProcessor(params.previewers ?? []),
    );
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

  async start(
    denops: Denops,
    { args }: { args: string[] },
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
    const cmdliner = new Cmdliner({
      cmdline: this.#inputComponent.cmdline,
      cmdpos: this.#inputComponent.cmdpos,
    });
    const scheduler = stack.use(new Scheduler(this.#schedulerInterval));
    const waiter = scheduler.start(async () => {
      // Check cmdline/cmdpos
      await cmdliner.check(denops);

      // Handle events synchronously
      consume((event) => this.#handleEvent(event, { accept, reserve }));

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

  #handleEvent(event: Event, { accept, reserve }: {
    accept: (name: string) => Promise<void>;
    reserve: (callback: ReservedCallback) => void;
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
          // NOTE:
          // We need to restart from the matcher processor because
          // sorters and renderers applies changes in-place thus
          // the items would be polluted.
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          });
        });
        break;
      }
      case "switch-sorter-at":
        this.#sortProcessor.sorterIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // NOTE:
          // We need to restart from the matcher processor because
          // sorters and renderers applies changes in-place thus
          // the items would be polluted.
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
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
          // NOTE:
          // We need to restart from the matcher processor because
          // sorters and renderers applies changes in-place thus
          // the items would be polluted.
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
          });
        });
        break;
      }
      case "switch-renderer-at":
        this.#renderProcessor.rendererIndex = event.index;
        this.#listComponent.title = this.#getExtensionIndicator();
        reserve((denops) => {
          // NOTE:
          // We need to restart from the matcher processor because
          // sorters and renderers applies changes in-place thus
          // the items would be polluted.
          this.#matchProcessor.start(denops, {
            items: this.#collectProcessor.items,
            query: this.#inputComponent.cmdline,
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
        reserve((denops) => {
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
        reserve((denops) => {
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
        reserve((denops) => {
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

  [Symbol.asyncDispose]() {
    return this.#stack[Symbol.asyncDispose]();
  }
}

async function getScreenSize(denops: Denops): Promise<Size> {
  const [width, height] = await collect(denops, (denops) => [
    opt.columns.get(denops),
    opt.lines.get(denops),
  ]);
  return { width, height };
}
