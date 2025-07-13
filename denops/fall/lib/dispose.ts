import { isObjectOf } from "@core/unknownutil/is/object-of";
import { isFunction } from "@core/unknownutil/is/function";

const isDisposable = isObjectOf({
  [Symbol.dispose]: isFunction,
});

const isAsyncDisposable = isObjectOf({
  [Symbol.asyncDispose]: isFunction,
});

/**
 * Dispose the resource.
 *
 * It tries to call Symbol.dispose or Symbol.asyncDispose if the resource has
 * the method.
 */
export async function dispose(resource: unknown): Promise<void> {
  if (isDisposable(resource)) {
    resource[Symbol.dispose]();
  }
  if (isAsyncDisposable(resource)) {
    await resource[Symbol.asyncDispose]();
  }
}
