import type { Detail } from "jsr:@vim-fall/core@^0.3.0/item";

import type { PickerContext } from "./picker.ts";

/**
 * In-memory storage for picker sessions.
 * Sessions are stored in chronological order (oldest first).
 */
// deno-lint-ignore no-explicit-any
const sessions: PickerSession<any>[] = [];

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
 * Lists all stored picker sessions in reverse chronological order (newest first).
 * @returns A readonly array of sessions
 */
export function listPickerSessions(): readonly PickerSession<Detail>[] {
  return sessions.slice().reverse(); // Return a copy in reverse order
}

/**
 * Saves a picker session to the in-memory storage.
 * If the storage exceeds MAX_SESSION_COUNT, the oldest session is removed.
 * @template T - The type of item detail in the picker
 * @param session - The session to save
 */
export function savePickerSession<T extends Detail>(
  session: PickerSession<T>,
): void {
  sessions.push(session);
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
 * @returns The session, or undefined if not found
 * @example
 * ```ts
 * // Load the most recent session
 * const session1 = loadPickerSession();
 *
 * // Load the second most recent session
 * const session2 = loadPickerSession({ number: 2 });
 *
 * // Load the most recent session with name "file"
 * const session3 = loadPickerSession({ name: "file", number: 1 });
 * ```
 */
export function loadPickerSession<T extends Detail>(
  { name, number: indexFromLatest }: LoadPickerSessionOptions = {},
): PickerSession<T> | undefined {
  const filteredSessions = name
    ? sessions.filter((s) => s.name === name)
    : sessions;
  const index = filteredSessions.length - (indexFromLatest ?? 1);
  return filteredSessions.at(index) as PickerSession<T> | undefined;
}
