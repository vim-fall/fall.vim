/**
 * Utility functions for parsing and processing command-line arguments.
 * @module
 */

/**
 * Parse command line arguments respecting quotes and escapes.
 *
 * This function properly handles:
 * - Double quotes (`"`)
 * - Single quotes (`'`)
 * - Escape sequences (`\`)
 * - Nested quotes of different types
 *
 * Note on edge cases:
 * - Unclosed quotes: treated as part of the argument value
 * - Trailing backslash: ignored (escape with no following character)
 * - Empty string or only spaces: returns empty array
 *
 * @param cmdline - The command line string to parse
 * @returns Array of parsed arguments
 *
 * @example
 * ```ts
 * parseArgs('file -input="Hello world"')
 * // => ['file', '-input=Hello world']
 *
 * parseArgs("file -input='test'")
 * // => ['file', '-input=test']
 *
 * parseArgs('file -input="He said \\"hello\\""')
 * // => ['file', '-input=He said "hello"']
 *
 * parseArgs('file -input="unclosed')
 * // => ['file', '-input=unclosed'] (unclosed quote)
 * ```
 */
export function parseArgs(cmdline: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let escaped = false;

  for (const char of cmdline) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"' || char === "'") {
      if (inQuote === char) {
        inQuote = null;
      } else if (inQuote === null) {
        inQuote = char;
      } else {
        current += char;
      }
    } else if (char === " " && inQuote === null) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Extract option arguments from argument list.
 *
 * All arguments with the matching prefix are extracted and returned as an array.
 * The caller can decide whether to use the first, last, or all values.
 *
 * @param args - Array of arguments to search
 * @param prefix - Option prefix to extract (e.g., '-input=')
 * @returns Tuple of [array of extracted values, remaining arguments]
 *
 * @example
 * ```ts
 * extractOption(['-input=Hello', 'file', '/path'], '-input=')
 * // => [['Hello'], ['file', '/path']]
 *
 * extractOption(['file', '/path'], '-input=')
 * // => [[], ['file', '/path']]
 *
 * extractOption(['-input=first', 'file', '-input=second'], '-input=')
 * // => [['first', 'second'], ['file']]
 * ```
 */
export function extractOption(
  args: readonly string[],
  prefix: string,
): [string[], string[]] {
  const values: string[] = [];
  const remaining: string[] = [];

  for (const arg of args) {
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    } else {
      remaining.push(arg);
    }
  }

  return [values, remaining];
}
