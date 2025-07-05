import type { Detail } from "jsr:@vim-fall/core@^0.3.0/item";
import { brotli } from "jsr:@deno-library/compress@^0.5.6";

import type { PickerContext } from "./picker.ts";

/**
 * In-memory storage for compressed picker sessions.
 * Sessions are stored in chronological order (oldest first).
 */
// deno-lint-ignore no-explicit-any
const sessions: PickerSessionCompressed<any>[] = [];

/**
 * Maximum number of sessions to keep in memory.
 * Oldest sessions are removed when this limit is exceeded.
 */
const MAX_SESSION_COUNT = 100;

/**
 * Represents a picker session with all its state information.
 * @template T - The type of item detail in the picker
 */
export type PickerSession<T extends Detail> = {
  readonly name: string;
  /** Arguments passed to the source */
  readonly args: readonly string[];
  /** The internal state context of the picker */
  readonly context: PickerContext<T>;
};

/**
 * Compressed version of PickerSession where the context is stored as binary data.
 * This reduces memory usage when storing multiple sessions.
 * @template T - The type of item detail in the picker
 */
export type PickerSessionCompressed<T extends Detail> =
  & Omit<PickerSession<T>, "context">
  & {
    /** Brotli-compressed binary representation of the context */
    context: Uint8Array;
  };

/**
 * Compresses a picker session by converting its context to brotli-compressed binary data.
 * This is used internally to reduce memory usage when storing sessions.
 * @template T - The type of item detail in the picker
 * @param session - The session to compress
 * @returns A promise that resolves to the compressed session
 */
async function compressPickerSession<T extends Detail>(
  session: PickerSession<T>,
): Promise<PickerSessionCompressed<T>> {
  const encoder = new TextEncoder();
  // Convert Set to Array for JSON serialization
  const contextForSerialization = {
    ...session.context,
    selection: Array.from(session.context.selection),
  };
  return {
    ...session,
    context: await brotli.compress(
      encoder.encode(JSON.stringify(contextForSerialization)),
    ),
  };
}

/**
 * Decompresses a picker session by converting its binary context back to structured data.
 * @template T - The type of item detail in the picker
 * @param compressed - The compressed session to decompress
 * @returns A promise that resolves to the decompressed session
 */
export async function decompressPickerSession<T extends Detail>(
  compressed: PickerSessionCompressed<T>,
): Promise<PickerSession<T>> {
  const decoder = new TextDecoder();
  const decompressedContext = JSON.parse(
    decoder.decode(await brotli.uncompress(compressed.context)),
  );
  // Convert selection array back to Set
  return {
    ...compressed,
    context: {
      ...decompressedContext,
      selection: new Set(decompressedContext.selection),
    },
  };
}

/**
 * Lists all stored picker sessions in reverse chronological order (newest first).
 * @returns A readonly array of compressed sessions
 */
export function listPickerSessions(): readonly PickerSessionCompressed<
  Detail
>[] {
  return sessions.slice().reverse(); // Return a copy in reverse order
}

/**
 * Saves a picker session to the in-memory storage.
 * The session is compressed before storage to reduce memory usage.
 * If the storage exceeds MAX_SESSION_COUNT, the oldest session is removed.
 * @template T - The type of item detail in the picker
 * @param session - The session to save
 * @returns A promise that resolves when the session is saved
 */
export async function savePickerSession<T extends Detail>(
  session: PickerSession<T>,
): Promise<void> {
  const compressed = await compressPickerSession(session);
  sessions.push(compressed);
  if (sessions.length > MAX_SESSION_COUNT) {
    sessions.shift(); // Keep only the last MAX_SESSION_COUNT sessions
  }
}

/**
 * Options for loading a picker session.
 */
export type LoadPickerSessionOptions = {
  /** Optional name to filter sessions by source name */
  name?: string;
  /** Optional number from the latest session to load (1 = most recent, 2 = second most recent, etc.) */
  number?: number;
};

/**
 * Loads a picker session from storage.
 * @template T - The type of item detail in the picker
 * @param indexFromLatest - The index from the latest session (0 = most recent, 1 = second most recent, etc.)
 * @param options - Options to filter sessions
 * @returns A promise that resolves to the decompressed session, or undefined if not found
 * @example
 * ```ts
 * // Load the most recent session
 * const session1 = await loadPickerSession();
 *
 * // Load the second most recent session
 * const session2 = await loadPickerSession({ number: 2 });
 *
 * // Load the most recent session with name "file"
 * const session3 = await loadPickerSession({ name: "file", number: 1 });
 * ```
 */
export async function loadPickerSession<T extends Detail>(
  { name, number: indexFromLatest }: LoadPickerSessionOptions = {},
): Promise<PickerSession<T> | undefined> {
  const filteredSessions = name
    ? sessions.filter((s) => s.name === name)
    : sessions;
  const index = filteredSessions.length - (indexFromLatest ?? 1);
  const compressed = filteredSessions.at(index);
  if (!compressed) {
    return undefined;
  }
  return await decompressPickerSession(compressed);
}
