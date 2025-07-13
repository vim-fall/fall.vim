import type { Entrypoint } from "@denops/std";
import { as, ensure, is, type Predicate } from "@core/unknownutil";

import { dispatch, type Event } from "../event.ts";
import { withHandleError } from "../error.ts";

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    ...denops.dispatcher,
    "event:dispatch": withHandleError(denops, (event) => {
      dispatch(ensure(event, isEventComplement));
    }),
  };
};

const isSelectMethod = is.LiteralOneOf(["on", "off", "toggle"] as const);

// NOTE:
// Only event that is dispatched from Vim requires predicate function.
// So this is NOT a full list of event types.
export const isEventComplement = is.UnionOf([
  // Cursor
  is.ObjectOf({
    type: is.LiteralOf("move-cursor"),
    amount: is.Number,
    scroll: as.Optional(is.Boolean),
  }),
  is.ObjectOf({
    type: is.LiteralOf("move-cursor-at"),
    cursor: is.UnionOf([is.Number, is.LiteralOf("$")]),
  }),
  // Select
  is.ObjectOf({
    type: is.LiteralOf("select-item"),
    cursor: as.Optional(is.UnionOf([is.Number, is.LiteralOf("$")])),
    method: as.Optional(isSelectMethod),
  }),
  is.ObjectOf({
    type: is.LiteralOf("select-all-items"),
    method: as.Optional(isSelectMethod),
  }),
  // Switch
  is.ObjectOf({
    type: is.LiteralOf("switch-matcher"),
    amount: is.Number,
    cycle: as.Optional(is.Boolean),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-matcher-at"),
    index: is.UnionOf([is.Number, is.LiteralOf("$")]),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-sorter"),
    amount: is.Number,
    cycle: as.Optional(is.Boolean),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-sorter-at"),
    index: is.UnionOf([is.Number, is.LiteralOf("$")]),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-renderer"),
    amount: is.Number,
    cycle: as.Optional(is.Boolean),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-renderer-at"),
    index: is.UnionOf([is.Number, is.LiteralOf("$")]),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-previewer"),
    amount: is.Number,
    cycle: as.Optional(is.Boolean),
  }),
  is.ObjectOf({
    type: is.LiteralOf("switch-previewer-at"),
    index: is.UnionOf([is.Number, is.LiteralOf("$")]),
  }),
  // Action
  is.ObjectOf({
    type: is.LiteralOf("action-invoke"),
    name: is.String,
  }),
  // List
  is.ObjectOf({
    type: is.LiteralOf("list-component-execute"),
    command: is.String,
  }),
  // Preview
  is.ObjectOf({
    type: is.LiteralOf("preview-component-execute"),
    command: is.String,
  }),
  // Help
  is.ObjectOf({
    type: is.LiteralOf("help-component-toggle"),
  }),
  is.ObjectOf({
    type: is.LiteralOf("help-component-page"),
    amount: is.Number,
  }),
]) satisfies Predicate<Event>;
