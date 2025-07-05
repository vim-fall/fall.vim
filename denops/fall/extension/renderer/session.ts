import type { Denops } from "jsr:@denops/std@^7.3.2";
import type { Renderer } from "jsr:@vim-fall/core@^0.3.0/renderer";
import type { DisplayItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { Detail } from "../source/session.ts";

export function session(): Renderer<Detail> {
  return {
    render(
      _denops: Denops,
      { items }: { items: DisplayItem<Detail>[] },
      { signal }: { signal?: AbortSignal },
    ): void {
      for (const item of items) {
        if (signal?.aborted) break;
        item.label = [
          item.value,
          item.detail.name,
          ...item.detail.args,
        ].join(" ");
      }
    },
  };
}
