/**
 * @file lib/color.ts
 * @description ColorPalette interface and factory function
 *   for terminal-colored output via picocolors.
 */

import pc from "picocolors";

export interface ColorPalette {
  /** Section title / comment lines (#). */
  comment(t: string): string;
  /** Configured variable — ✓ */
  ok(t: string): string;
  /** Missing required variable — ✗ */
  error(t: string): string;
  /** Optional/unset/dim text — — */
  muted(t: string): string;
  /** Variable name in explain output. */
  key(t: string): string;
  /** Plain value (e.g. 5432, false) in explain output. */
  value(t: string): string;
  /** Type-hint marker (<number>, <boolean>, <url>, <string>) in explain output. */
  typeHint(t: string): string;
  /** Type validation failure — ⚠ */
  warn(t: string): string;
}

/** Auto-detects TTY + NO_COLOR when `enabled` is omitted. */
export function makeColorPalette(enabled = pc.isColorSupported): ColorPalette {
  const c = pc.createColors(enabled);
  return {
    comment: (t) => c.dim(c.greenBright(t)),
    ok: (t) => c.green(t),
    error: (t) => c.red(t),
    muted: (t) => c.dim(t),
    key: (t) => c.bold(t),
    value: (t) => c.yellow(t),
    typeHint: (t) => c.cyan(t),
    warn: (t) => c.yellow(t),
  };
}
