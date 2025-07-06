export type DebounceOptions = {
  delay?: number;
  signal?: AbortSignal;
};

/**
 * Creates a debounced function that delays invoking the provided function until after
 * the specified delay has elapsed since the last time the debounced function was invoked.
 *
 * @param fn - The function to debounce
 * @param options - Configuration options
 * @param options.delay - The number of milliseconds to delay (default: 0)
 * @param options.signal - An optional AbortSignal to cancel the debounced function
 * @returns A debounced version of the function
 *
 * @example
 * ```ts
 * import { debounce } from "./debounce.ts";
 * import { delay } from "jsr:@std/async@^1.0.0/delay";
 *
 * const saveData = () => console.log("Saving data...");
 * const debouncedSave = debounce(() => saveData(), { delay: 100 });
 *
 * // Multiple calls within 100ms will only trigger one save
 * debouncedSave();
 * debouncedSave();
 * debouncedSave();
 *
 * // Wait for the debounced function to execute
 * await delay(150);
 *
 * // Cancel via AbortSignal
 * const doWork = () => console.log("Doing work...");
 * const controller = new AbortController();
 * const debouncedFunc = debounce(() => doWork(), {
 *   delay: 50,
 *   signal: controller.signal
 * });
 * debouncedFunc();
 * controller.abort(); // Cancels any pending execution
 * ```
 */
// deno-lint-ignore no-explicit-any
export function debounce<F extends (...args: any[]) => void>(
  fn: F,
  { delay, signal }: DebounceOptions = {},
): F {
  let timerId: number | undefined;

  const abort = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  };

  signal?.addEventListener("abort", abort, { once: true });
  return ((...args) => {
    abort();
    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...args);
    }, delay);
  }) as F;
}
