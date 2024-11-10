export type Consumer = (event: Readonly<Event>) => void;

let eventQueue: Readonly<Event>[] = [];

export function dispatch(event: Readonly<Event>): void {
  eventQueue.push(event);
}

export function consume(consumer: Consumer): void {
  const events = eventQueue;
  eventQueue = [];
  events.forEach(consumer);
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
  | { type: "action-invoke"; name: string }
  | { type: "list-component-execute"; command: string }
  | { type: "preview-component-execute"; command: string }
  | { type: "collect-processor-started" }
  | { type: "collect-processor-updated" }
  | { type: "collect-processor-succeeded" }
  | { type: "collect-processor-failed"; err: unknown }
  | { type: "match-processor-started" }
  | { type: "match-processor-updated" }
  | { type: "match-processor-succeeded" }
  | { type: "match-processor-failed"; err: unknown }
  | { type: "visualize-processor-started" }
  | { type: "visualize-processor-succeeded" }
  | { type: "visualize-processor-failed"; err: unknown }
  | { type: "preview-processor-started" }
  | { type: "preview-processor-succeeded" }
  | { type: "preview-processor-failed"; err: unknown };
