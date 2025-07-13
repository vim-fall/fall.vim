import type { Denops } from "@denops/std";
import type { Renderer } from "@vim-fall/core/renderer";
import type { DisplayItem } from "@vim-fall/core/item";
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
