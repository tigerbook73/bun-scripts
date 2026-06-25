/**
 * @file lib/types.ts
 * @description Shared type definitions for check-env:
 *   example sections, resolved variables, and display modes.
 */

export interface ExampleVar {
  name: string;
  required: boolean;
  /** Non-null only for optional vars (# KEY=value) — the reference value from .env.example */
  exampleValue: string | null;
  /** Non-null when `default: X` appears in the inline comment — the app's built-in default. */
  defaultValue: string | null;
  isSecret: boolean;
  /** Full inline comment text (without leading # and space), e.g. "number, unit: seconds, default: 30" */
  inlineComment: string | null;
  /** Parsed type hint from <type> marker, e.g. "number", "boolean", "url". Null if none or if <secret>. */
  typeHint: string | null;
}

export interface ExampleSection {
  title: string | null;
  vars: ExampleVar[];
}

export interface ResolvedVar extends ExampleVar {
  /** Filename (e.g. ".env.local") if configured in any env file, otherwise null */
  source: string | null;
  /** Actual value if configured, otherwise null */
  value: string | null;
  /** False when value is set and fails the declared typeHint check. True when unset or no hint. */
  typeValid: boolean;
}

export interface ResolvedSection {
  title: string | null;
  vars: ResolvedVar[];
}

/** Environment name: "dev" and "prod" have predefined file chains; any other name is inferred. */
export type Env = string;

export type CheckDisplay = "verbose" | "quiet" | "silent" | "mismatch";
