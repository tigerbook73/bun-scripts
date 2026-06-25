export interface ExampleVar {
  name: string;
  required: boolean;
  /** Non-null only for optional vars (# KEY=value) — the reference value from .env.example */
  exampleValue: string | null;
  /** Non-null when `default: X` appears in the inline comment — the app's built-in default. */
  defaultValue: string | null;
  isSecret: boolean;
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
}

export interface ResolvedSection {
  title: string | null;
  vars: ResolvedVar[];
}

export type Env = "dev" | "prod";
