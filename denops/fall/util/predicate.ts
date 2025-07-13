import { as, is, type Predicate } from "@core/unknownutil";
import type {
  Action,
  Coordinator,
  Curator,
  Detail,
  Matcher,
  Previewer,
  Renderer,
  Sorter,
  Source,
  Theme,
} from "@vim-fall/core";

import type { PickerParams, Setting } from "../custom.ts";

export const isStringArray = is.ArrayOf(is.String);

export const isAbortSignal = is.InstanceOf(AbortSignal) as Predicate<
  AbortSignal
>;

export const isTheme = is.ObjectOf({
  border: is.UniformTupleOf(8, is.String),
  divider: is.UniformTupleOf(6, is.String),
}) satisfies Predicate<Theme>;

export const isCoordinator = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  style: is.Function as Predicate<any>,
  // deno-lint-ignore no-explicit-any
  layout: is.Function as Predicate<any>,
}) satisfies Predicate<Coordinator>;

export const isCurator = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  curate: is.Function as Predicate<any>,
}) satisfies Predicate<Curator<Detail>>;

export const isSource = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  collect: is.Function as Predicate<any>,
}) satisfies Predicate<Source<Detail>>;

export const isMatcher = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  match: is.Function as Predicate<any>,
}) satisfies Predicate<Matcher<Detail>>;

export const isSorter = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  sort: is.Function as Predicate<any>,
}) satisfies Predicate<Sorter<Detail>>;

export const isRenderer = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  render: is.Function as Predicate<any>,
}) satisfies Predicate<Renderer<Detail>>;

export const isPreviewer = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  preview: is.Function as Predicate<any>,
}) satisfies Predicate<Previewer<Detail>>;

export const isAction = is.ObjectOf({
  // deno-lint-ignore no-explicit-any
  invoke: is.Function as Predicate<any>,
}) satisfies Predicate<Action<Detail>>;

export const isSetting = is.ObjectOf({
  coordinator: isCoordinator,
  theme: isTheme,
}) satisfies Predicate<Setting>;

export const isPickerParams = is.ObjectOf({
  name: is.String,
  source: isSource,
  actions: is.RecordOf(isAction, is.String),
  defaultAction: is.String,
  matchers: is.ArrayOf(isMatcher) as Predicate<
    [Matcher<Detail>, ...Matcher<Detail>[]]
  >,
  sorters: as.Optional(is.ArrayOf(isSorter)),
  renderers: as.Optional(is.ArrayOf(isRenderer)),
  previewers: as.Optional(is.ArrayOf(isPreviewer)),
  coordinator: as.Optional(isCoordinator),
  theme: as.Optional(isTheme),
}) satisfies Predicate<PickerParams<Detail, string>>;

export const isOptions = is.ObjectOf({
  signal: as.Optional(isAbortSignal),
});

export function isIncrementalMatcher<T extends Detail>(m: Matcher<T>): boolean {
  return (m as { incremental?: boolean }).incremental ?? false;
}
