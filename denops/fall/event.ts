export type Consumer = (event: Readonly<Event>) => void;

let eventQueue: Readonly<Event>[] = [];

export function dispatch(event: Readonly<Event>): void {
  eventQueue.push(event);
}

export function consume(consumer: Consumer): void {
  // Optimize: Swap arrays instead of creating new ones each time
  const events = eventQueue;
  if (events.length === 0) return;

  eventQueue = [];
  // Use for loop instead of forEach for better performance
  for (let i = 0; i < events.length; i++) {
    consumer(events[i]);
  }
}

type SelectMethod = "on" | "off" | "toggle";

export type Event =
  | { type: "vim-cmdline-changed"; cmdline: string }
  | { type: "vim-cmdpos-changed"; cmdpos: number }
  | { type: "move-cursor"; amount: number; scroll?: boolean }
  | { type: "move-cursor-at"; cursor: number | "$" }
  | { type: "select-item"; cursor?: number | "$"; method?: SelectMethod }
  | { type: "select-all-items"; method?: SelectMethod }
  | { type: "switch-matcher"; amount: number; cycle?: boolean }
  | { type: "switch-matcher-at"; index: number | "$" }
  | { type: "switch-sorter"; amount: number; cycle?: boolean }
  | { type: "switch-sorter-at"; index: number | "$" }
  | { type: "switch-renderer"; amount: number; cycle?: boolean }
  | { type: "switch-renderer-at"; index: number | "$" }
  | { type: "switch-previewer"; amount: number; cycle?: boolean }
  | { type: "switch-previewer-at"; index: number | "$" }
  | { type: "action-invoke"; name: string }
  | { type: "list-component-execute"; command: string }
  | { type: "preview-component-execute"; command: string }
  | { type: "help-component-toggle" }
  | { type: "help-component-page"; amount: number }
  | { type: "collect-processor-started" }
  | { type: "collect-processor-updated" }
  | { type: "collect-processor-succeeded" }
  | { type: "collect-processor-failed"; err: unknown }
  | { type: "match-processor-started" }
  | { type: "match-processor-updated" }
  | { type: "match-processor-succeeded" }
  | { type: "match-processor-failed"; err: unknown }
  | { type: "sort-processor-started" }
  | { type: "sort-processor-succeeded" }
  | { type: "sort-processor-failed"; err: unknown }
  | { type: "render-processor-started" }
  | { type: "render-processor-succeeded" }
  | { type: "render-processor-failed"; err: unknown }
  | { type: "preview-processor-started" }
  | { type: "preview-processor-succeeded" }
  | { type: "preview-processor-failed"; err: unknown };
