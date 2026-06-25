import pc from "picocolors";

export class ColorPalette {
  private readonly c: ReturnType<typeof pc.createColors>;

  /** Auto-detects TTY + NO_COLOR when `enabled` is omitted. */
  constructor(enabled = pc.isColorSupported) {
    this.c = pc.createColors(enabled);
  }

  /** Section title / comment lines (#). */
  comment(t: string): string {
    return this.c.dim(this.c.green(t));
  }

  /** Configured variable — ✓ */
  ok(t: string): string {
    return this.c.green(t);
  }

  /** Missing required variable — ✗ */
  error(t: string): string {
    return this.c.red(t);
  }

  /** Optional/unset/dim text — — */
  muted(t: string): string {
    return this.c.dim(t);
  }

  /** Variable name in --explain output. */
  key(t: string): string {
    return this.c.bold(t);
  }

  /** Plain value (e.g. 5432, false) in --explain output. */
  value(t: string): string {
    return this.c.yellow(t);
  }

  /** Type-hint marker (<number>, <boolean>, <url>, <string>) in --explain output. */
  typeHint(t: string): string {
    return this.c.cyan(t);
  }

  /** Type validation failure — ⚠ */
  warn(t: string): string {
    return this.c.yellow(t);
  }
}
