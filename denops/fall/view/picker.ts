import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as opt from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import { g } from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import {
  batch,
  collect,
} from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";

import type {
  Item,
  Previewer,
  Projector,
  Renderer,
  RendererItem,
  SourceItem,
  Transformer,
} from "../extension/type.ts";
import { isDefined } from "../util/collection.ts";
import { subscribe } from "../util/event.ts";
import { startAsyncScheduler } from "../util/async_scheduler.ts";
import { buildLayout, Layout, LayoutParams } from "./layout/picker_layout.ts";
import { QueryComponent } from "./component/query.ts";
import { SelectComponent } from "./component/select.ts";
import { PreviewComponent } from "./component/preview.ts";
import { observeInput, startInput } from "./util/input.ts";
import { ItemCollector } from "../service/item_collector.ts";
import { ItemProcessor } from "../service/item_processor.ts";
import { ItemFormatter } from "../service/item_formatter.ts";

export type PickerContext = {
  readonly query: string;
  readonly index: number;
  readonly selected: Set<unknown>;
};

export type PickerOptions = Readonly<{
  title?: string;
  selectable?: boolean;
  restoreContext?: PickerContext;
  layout?: Partial<LayoutParams>;
  redraw?: Readonly<{
    interval?: number;
  }>;
  query?: Readonly<{
    spinner?: readonly string[];
    headSymbol?: string;
    failSymbol?: string;
  }>;
  itemCollector?: Readonly<{
    threshold?: number;
  }>;
}>;

export class Picker implements AsyncDisposable {
  readonly #previewers: readonly Previewer[];
  readonly #options: PickerOptions;
  readonly #itemCollector: ItemCollector;
  readonly #itemProcessor: ItemProcessor;
  readonly #itemFormatter: ItemFormatter;
  readonly #disposable: AsyncDisposableStack;

  #layout?: Layout;
  #cmdpos = 0;
  #query = "";
  #index = 0;
  #selected = new Set<unknown>();

  private constructor(
    itemCollector: ItemCollector,
    itemProcessor: ItemProcessor,
    itemFormatter: ItemFormatter,
    previewers: readonly Previewer[],
    options: PickerOptions,
    stack: AsyncDisposableStack,
  ) {
    this.#itemCollector = itemCollector;
    this.#itemProcessor = itemProcessor;
    this.#itemFormatter = itemFormatter;
    this.#previewers = previewers;
    this.#options = options;
    this.#disposable = stack;
  }

  static async fromStream(
    denops: Denops,
    stream: ReadableStream<SourceItem>,
    transformers: readonly Transformer[],
    projectors: readonly Projector[],
    renderers: readonly Renderer[],
    previewers: readonly Previewer[],
    options: PickerOptions,
  ): Promise<Picker> {
    const scrolloff = await opt.scrolloff.get(denops);

    await using stack = new AsyncDisposableStack();
    const itemCollector = stack.use(
      new ItemCollector({
        stream,
        threshold: options.itemCollector?.threshold,
      }),
    );
    const itemProcessor = stack.use(
      new ItemProcessor({ transformers, projectors }),
    );
    const itemFormatter = stack.use(
      new ItemFormatter({
        renderers,
        scrolloff,
      }),
    );
    const picker = new Picker(
      itemCollector,
      itemProcessor,
      itemFormatter,
      previewers,
      options,
      stack.move(),
    );
    if (options.restoreContext) {
      picker.#query = options.restoreContext.query;
      picker.#index = options.restoreContext.index;
      picker.#selected = options.restoreContext.selected;
    }
    return picker;
  }

  get context(): PickerContext {
    return {
      query: this.#query,
      index: this.#index,
      selected: this.#selected,
    };
  }

  get collectedItems(): readonly Item[] {
    return this.#itemCollector.items;
  }

  get processedItems(): readonly Item[] {
    return this.#itemProcessor.items;
  }

  get formattedItems(): readonly RendererItem[] {
    return this.#itemFormatter.items;
  }

  get selectedItems(): readonly Item[] {
    const m = new Map(this.processedItems.map((v) => [v.id, v]));
    return [...this.#selected].map((v) => m.get(v)).filter(isDefined);
  }

  get cursorItem(): Item | undefined {
    return this.processedItems.at(this.#index);
  }

  #correctIndex(index: number): number {
    const max = this.processedItems.length - 1;
    return Math.max(0, Math.min(max, index));
  }

  async open(denops: Denops): Promise<AsyncDisposable> {
    if (this.#layout) {
      throw new Error("The picker is already opened");
    }
    this.#layout = await buildLayout(denops, {
      title: this.#options.title,
      width: this.#options.layout?.width,
      widthRatio: this.#options.layout?.widthRatio ?? WIDTH_RATION,
      widthMin: this.#options.layout?.widthMin ?? WIDTH_MIN,
      widthMax: this.#options.layout?.widthMax ?? WIDTH_MAX,
      height: this.#options.layout?.height,
      heightRatio: this.#options.layout?.heightRatio ?? HEIGHT_RATION,
      heightMin: this.#options.layout?.heightMin ?? HEIGHT_MIN,
      heightMax: this.#options.layout?.heightMax ?? HEIGHT_MAX,
      previewRatio: this.#options.layout?.previewRatio ?? PREVIEW_RATION,
      border: this.#options.layout?.border,
      divider: this.#options.layout?.divider,
      zindex: this.#options.layout?.zindex ?? 50,
    });
    this.#disposable.use(this.#layout);
    return {
      [Symbol.asyncDispose]: async () => {
        if (this.#layout) {
          await this.#layout[Symbol.asyncDispose]();
          this.#layout = undefined;
        }
      },
    };
  }

  async start(
    denops: Denops,
    options: { signal: AbortSignal },
  ): Promise<boolean> {
    if (!this.#layout) {
      throw new Error("The picker is not opnend");
    }
    const layout = this.#layout;

    await using stack = new AsyncDisposableStack();
    const controller = new AbortController();
    const signal = AbortSignal.any([options.signal, controller.signal]);
    stack.defer(() => {
      try {
        controller.abort();
      } catch {
        // Fail silently
      }
    });

    // Set internal variables
    await batch(denops, async (denops) => {
      await g.set(
        denops,
        "_fall_layout_query_winid",
        layout.query.winid,
      );
      await g.set(
        denops,
        "_fall_layout_select_winid",
        layout.select.winid,
      );
      await g.set(
        denops,
        "_fall_layout_preview_winid",
        layout.preview.winid,
      );
    });

    // Collect informations
    const [queryWinwidth, selectWinwidth, selectWinheight] = await collect(
      denops,
      (denops) => [
        fn.winwidth(denops, layout.query.winid),
        fn.winwidth(denops, layout.select.winid),
        fn.winheight(denops, layout.select.winid),
      ],
    );

    // Bind components to the layout
    const query = stack.use(
      new QueryComponent(
        layout.query.bufnr,
        layout.query.winid,
        {
          winwidth: queryWinwidth,
          spinner: this.#options.query?.spinner,
          headSymbol: this.#options.query?.headSymbol,
          failSymbol: this.#options.query?.failSymbol,
        },
      ),
    );
    const select = stack.use(
      new SelectComponent(
        layout.select.bufnr,
        layout.select.winid,
      ),
    );
    const preview = stack.use(
      new PreviewComponent(
        layout.preview.bufnr,
        layout.preview.winid,
        {
          previewers: this.#previewers,
        },
      ),
    );

    let renderQuery = true;
    let renderSelect = true;
    let renderPreview = true;
    const emitQueryUpdate = () => {
      renderQuery = true;
    };
    const emitSelectUpdate = () => {
      renderSelect = true;
    };
    const emitPreviewUpdate = () => {
      renderPreview = true;
    };
    const emitItemProcessor = () => {
      this.#itemProcessor.start({
        items: this.collectedItems,
        query: this.#query,
      }, {
        signal,
      });
    };
    const emitItemFormatter = () => {
      this.#itemFormatter.start({
        items: this.processedItems,
        index: this.#index,
        width: selectWinwidth,
        height: selectWinheight,
      }, {
        signal,
      });
    };

    stack.use(subscribe("item-collector-changed", () => {
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("item-collector-succeeded", () => {
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("item-collector-failed", () => {
      emitQueryUpdate();
    }));
    stack.use(subscribe("item-processor-succeeded", () => {
      this.#index = this.#correctIndex(this.#index);
      emitItemFormatter();
      emitQueryUpdate();
    }));
    stack.use(subscribe("item-processor-failed", () => {
      emitQueryUpdate();
    }));
    stack.use(subscribe("item-formatter-succeeded", () => {
      emitSelectUpdate();
      emitPreviewUpdate();
    }));
    stack.use(subscribe("item-formatter-failed", () => {
      emitSelectUpdate();
      emitPreviewUpdate();
    }));
    stack.use(subscribe("cmdline-changed", (cmdline) => {
      if (this.#query === cmdline) {
        return;
      }
      this.#query = cmdline;
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("cmdpos-changed", (cmdpos) => {
      if (this.#cmdpos === cmdpos) {
        return;
      }
      this.#cmdpos = cmdpos;
      emitQueryUpdate();
    }));
    stack.use(subscribe("select-cursor-move", (offset) => {
      const newIndex = this.#correctIndex(this.#index + offset);
      if (this.#index === newIndex) {
        return;
      }
      this.#index = newIndex;
      emitItemFormatter();
    }));
    stack.use(subscribe("select-cursor-move-at", (line) => {
      const newIndex = this.#correctIndex(
        line === "$" ? this.processedItems.length - 1 : line - 1,
      );
      if (this.#index === newIndex) {
        return;
      }
      this.#index = newIndex;
      emitItemFormatter();
    }));
    stack.use(subscribe("preview-cursor-move", (offset) => {
      preview.moveCursor(denops, offset, { signal });
      emitPreviewUpdate();
    }));
    stack.use(subscribe("preview-cursor-move-at", (line) => {
      preview.moveCursorAt(denops, line, { signal });
      emitPreviewUpdate();
    }));
    stack.use(subscribe("preview-previewer-rotate", (offset) => {
      preview.previewerIndex += offset;
      emitPreviewUpdate();
    }));
    if (this.#options.selectable) {
      stack.use(subscribe("select-select", () => {
        const item = this.cursorItem;
        if (!item) return;
        if (this.#selected.has(item.id)) {
          this.#selected.delete(item.id);
        } else {
          this.#selected.add(item.id);
        }
        emitSelectUpdate();
      }));
      stack.use(subscribe("select-select-all", () => {
        if (this.#selected.size === this.processedItems.length) {
          this.#selected.clear();
        } else {
          this.#selected = new Set(
            this.processedItems.map((v) => v.id),
          );
        }
        emitSelectUpdate();
      }));
    }

    startAsyncScheduler(
      async () => {
        const collecting = this.#itemCollector.processing;
        const processing = this.#itemProcessor.processing;
        renderQuery ||= collecting || processing;

        if (!renderQuery && !renderSelect && !renderPreview) {
          // No need to render & redraw
          return;
        }

        if (renderQuery) {
          renderQuery = false;
          await query.render(
            denops,
            {
              cmdline: this.#query,
              cmdpos: this.#cmdpos,
              collecting,
              processing,
              counter: {
                processed: this.processedItems.length,
                collected: this.collectedItems.length,
                truncated: this.#itemCollector.truncated,
              },
            },
            { signal },
          );
        }

        if (renderSelect) {
          renderSelect = false;
          await select.render(
            denops,
            {
              items: this.formattedItems,
              line: Math.max(0, this.#index - this.#itemFormatter.offset) + 1,
              selected: this.#selected,
            },
            { signal },
          );
        }

        if (renderPreview) {
          renderPreview = false;
          await preview.render(
            denops,
            this.cursorItem,
            { signal },
          );
        }

        await denops.cmd("redraw");
      },
      this.#options.redraw?.interval ?? REDRAW_INTERVAL,
      { signal },
    );

    // Observe Vim's prompt
    stack.use(observeInput(denops, { signal }));

    // Start collecting
    this.#itemCollector.start({ signal });

    // Wait for user input
    return await startInput(
      denops,
      { text: this.#query },
      { signal },
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#disposable.disposeAsync();
  }
}

const WIDTH_RATION = 0.9;
const WIDTH_MIN = 80;
const WIDTH_MAX = 800;
const HEIGHT_RATION = 0.9;
const HEIGHT_MIN = 5;
const HEIGHT_MAX = 300;
const PREVIEW_RATION = 0.65;
const REDRAW_INTERVAL = 0;
