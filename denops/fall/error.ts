import type { Denops } from "@denops/std";
import { AssertError } from "@core/unknownutil/assert";

/**
 * Application error that is used to represent an expected error.
 */
export class ExpectedError extends Error {
  constructor(message: string, public source?: unknown) {
    super(message);
  }
}

export async function handleError(
  denops: Denops,
  error: unknown,
): Promise<void> {
  if (error instanceof ExpectedError) {
    await denops.cmd(
      `redraw | echohl Error | echomsg '[fall] ${error.message}' | echohl None`,
    );
    return;
  }
  if (error instanceof AssertError) {
    await denops.cmd(
      `redraw | echohl Error | echomsg '[fall] ${error.message}' | echohl None`,
    );
    return;
  }
  console.error(error);
}

export function withHandleError<T, A extends unknown[]>(
  denops: Denops,
  fn: (...args: A) => T | Promise<T>,
): (...args: A) => Promise<T | undefined> {
  return async (...args: A): Promise<T | undefined> => {
    try {
      return await fn(...args);
    } catch (e) {
      // NOTE:
      // This setTimeout is required in Neovim to show the error message
      // properly. Otherwise, the error message is not shown maybe because
      // the msgarea is hidden during the picker execution.
      setTimeout(
        () => handleError(denops, e).catch((err) => console.error(err)),
        0,
      );
    }
  };
}
