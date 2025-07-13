import type { Denops } from "@denops/std";
import { emit } from "@denops/std/autocmd";

/**
 * Emit `User FallPickerEnterSystem:{name}` autocmd.
 */
export async function emitPickerEnterSystem(
  denops: Denops,
  name: string,
): Promise<void> {
  try {
    await emit(denops, "User", `FallPickerEnterSystem:${name}`, {
      nomodeline: true,
    });
  } catch (err) {
    console.warn(`[fall] Failed to emit FallPickerEnterSystem:${name}`, err);
  }
}

/**
 * Emit `User FallPickerLeaveSystem:{name}` autocmd.
 */
export async function emitPickerLeaveSystem(
  denops: Denops,
  name: string,
): Promise<void> {
  try {
    await emit(denops, "User", `FallPickerLeaveSystem:${name}`, {
      nomodeline: true,
    });
  } catch (err) {
    console.warn(`[fall] Failed to emit FallPickerLeaveSystem:${name}`, err);
  }
}
