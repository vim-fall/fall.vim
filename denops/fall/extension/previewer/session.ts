import type { PreviewItem } from "jsr:@vim-fall/core@^0.3.0/item";
import type { Previewer } from "jsr:@vim-fall/core@^0.3.0/previewer";
import { definePreviewer } from "jsr:@vim-fall/std@^0.10.0/previewer";
import type { Detail } from "../source/session.ts";

export function session(): Previewer<Detail> {
  return definePreviewer((_denops, { item }, { signal }) => {
    if (!item || signal?.aborted) {
      return undefined;
    }

    try {
      // Access the session data directly
      const session = item.detail;

      const lines: string[] = [];

      // Add session info
      lines.push(`# Session: ${item.value}`);
      lines.push("");
      lines.push(`Source: ${session.name}`);
      lines.push(`Query: ${session.context.query || "(empty)"}`);
      lines.push(`Total items: ${session.context.collectedItems.length}`);
      lines.push(`Filtered items: ${session.context.filteredItems.length}`);
      lines.push("");
      lines.push("## Filtered Items:");
      lines.push("");

      // Show filtered items with selection status
      const selection = session.context.selection;
      for (const filteredItem of session.context.filteredItems) {
        const isSelected = selection.has(filteredItem.id);
        const prefix = isSelected ? "[x]" : "[ ]";
        lines.push(`${prefix} ${filteredItem.value}`);
      }

      if (session.context.filteredItems.length === 0) {
        lines.push("(no items)");
      }

      return {
        content: lines,
        filetype: "markdown",
      } satisfies PreviewItem;
    } catch (error) {
      return {
        content: [`Error loading session preview: ${error}`],
      } satisfies PreviewItem;
    }
  });
}
