#!/usr/bin/env -S bun --env-file /dev/null

/**
 * check-env
 *
 * Validates that all required environment variables declared in .env.example
 * are configured in the current dev/prod environment files.
 *
 * Usage:
 *   check-env                   Verbose output for dev environment
 *   check-env --env prod        Check production environment
 *   check-env --silent          Only report missing variables (exit 1 if any)
 *   check-env --mismatch-only   List only required-but-unset variables
 *   check-env --explain         Show .env.example format reference
 *   check-env --help            Show this help
 */

import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type Env = "dev" | "prod";

// ─── Priority chains ─────────────────────────────────────────────────────────

const PRIORITY: Record<Env, string[]> = {
  dev: [".env", ".env.local", ".env.development", ".env.development.local"],
  prod: [".env", ".env.production", ".env.production.local"],
};

// ─── ColorPalette ─────────────────────────────────────────────────────────────

export class ColorPalette {
  private readonly c: ReturnType<typeof pc.createColors>;

  /** Auto-detects TTY + NO_COLOR when `enabled` is omitted. */
  constructor(enabled = pc.green("x") !== "x") {
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
}

// ─── Secret detection ────────────────────────────────────────────────────────

const SECRET_KEYWORDS = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PASS"];

export function isSecret(name: string, exampleValue: string | null): boolean {
  if (exampleValue === "<secret>") return true;
  const upper = name.toUpperCase();
  return SECRET_KEYWORDS.some((kw) => upper.includes(kw));
}

// ─── Value masking ───────────────────────────────────────────────────────────

export function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****";
}

// ─── .env.example parser ─────────────────────────────────────────────────────

const ACTIVE_KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
const OPTIONAL_KEY_RE = /^#\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/**
 * Extracts `default: X` from the inline comment portion of a raw value string.
 * e.g. `30    # number, unit: seconds, default: 30` → `"30"`
 */
function extractDefaultValue(raw: string): string | null {
  const hashIdx = raw.indexOf("#");
  if (hashIdx === -1) return null;
  const comment = raw.slice(hashIdx + 1);
  const match = /\bdefault:\s*(\S+)/.exec(comment);
  return match ? (match[1] ?? null) : null;
}

/** Strips inline comment and surrounding whitespace from a raw value string. */
function stripInlineComment(raw: string): string {
  // Handle quoted values first — don't strip # inside quotes
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed[0]!;
    const closing = trimmed.indexOf(quote, 1);
    if (closing !== -1) return trimmed.slice(1, closing);
    return trimmed.slice(1);
  }
  // Unquoted: strip from first #
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx === -1) return trimmed;
  return trimmed.slice(0, hashIdx).trimEnd();
}

/**
 * Parses .env.example into sections grouped by blank lines.
 * Sections with no KEY lines (active or optional) are dropped.
 */
export function parseEnvExample(content: string): ExampleSection[] {
  const lines = content.split("\n");
  const sections: ExampleSection[] = [];

  // Split into raw groups by blank lines (consecutive blanks = single separator)
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  const seenNames = new Set<string>();

  for (const group of groups) {
    // Leading # lines (that aren't optional keys) become the section title
    const commentLines: string[] = [];
    const varLines: string[] = [];
    let seenKey = false;
    for (const line of group) {
      if (!seenKey && line.startsWith("#")) {
        if (OPTIONAL_KEY_RE.test(line)) {
          seenKey = true;
          varLines.push(line);
        } else {
          commentLines.push(line);
        }
      } else {
        seenKey = true;
        varLines.push(line);
      }
    }

    const vars: ExampleVar[] = [];
    for (const line of varLines) {
      let match = ACTIVE_KEY_RE.exec(line);
      if (match) {
        const name = match[1]!;
        const rawValue = match[2] ?? "";
        if (seenNames.has(name)) {
          console.error(`Warning: duplicate key "${name}" in .env.example — skipping duplicate`);
          continue;
        }
        seenNames.add(name);
        vars.push({
          name,
          required: true,
          exampleValue: null,
          defaultValue: extractDefaultValue(rawValue),
          isSecret: isSecret(name, stripInlineComment(rawValue)),
        });
        continue;
      }
      match = OPTIONAL_KEY_RE.exec(line);
      if (match) {
        const name = match[1]!;
        const rawValue = match[2] ?? "";
        const exampleValue = stripInlineComment(rawValue) || null;
        if (seenNames.has(name)) continue; // commented alternative — silently skip
        seenNames.add(name);
        vars.push({
          name,
          required: false,
          exampleValue,
          defaultValue: extractDefaultValue(rawValue),
          isSecret: isSecret(name, exampleValue),
        });
      }
    }

    if (vars.length === 0) continue; // pure-comment section — ignore

    // Preserve original # markers in title lines
    const rawTitle = commentLines
      .map((l) => l.trimEnd())
      .join("\n")
      .trim();
    sections.push({ title: rawTitle || null, vars });
  }

  return sections;
}

// ─── .env file parser ────────────────────────────────────────────────────────

/** Parses a .env file into a key→value map. */
export function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawValue = trimmed.slice(eqIdx + 1);
    map.set(key, stripInlineComment(rawValue));
  }
  return map;
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Loads env files in priority order (low → high) and resolves each variable's
 * source file and actual value.
 */
export function resolveVars(sections: ExampleSection[], envFiles: string[]): ResolvedSection[] {
  const resolved = new Map<string, { value: string; source: string }>();
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const [key, value] of parseEnvFile(content)) {
      resolved.set(key, { value, source: file });
    }
  }

  return sections.map((section) => ({
    title: section.title,
    vars: section.vars.map((v): ResolvedVar => {
      const entry = resolved.get(v.name);
      return { ...v, source: entry?.source ?? null, value: entry?.value ?? null };
    }),
  }));
}

// ─── EnvChecker ──────────────────────────────────────────────────────────────

export class EnvChecker {
  private readonly sections: ResolvedSection[];
  private readonly color: ColorPalette;

  constructor(options: { exampleContent: string; envFiles: string[]; color: ColorPalette }) {
    this.sections = resolveVars(parseEnvExample(options.exampleContent), options.envFiles);
    this.color = options.color;
  }

  hasMissing(): boolean {
    return this.sections.some((s) =>
      s.vars.some((v) => v.required && v.source === null && v.defaultValue === null),
    );
  }

  printVerbose(): void {
    const { sections, color } = this;
    const maxLen = Math.max(...sections.flatMap((s) => s.vars.map((v) => v.name.length)));

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]!;

      if (section.title) {
        if (i > 0) process.stdout.write("\n");
        for (const line of section.title.split("\n")) {
          console.log(color.comment(line));
        }
      } else if (i > 0) {
        console.log("");
      }

      for (const v of section.vars) {
        console.log(`${this.statusChar(v)}  ${v.name.padEnd(maxLen)}  ${this.sourceText(v)}`);
      }
    }
  }

  printMismatchOnly(): void {
    const { color } = this;
    const mismatches = this.sections
      .flatMap((s) => s.vars)
      .filter((v) => v.required && v.source === null && v.defaultValue === null);

    for (const v of mismatches) {
      console.log(`${color.error("✗")}  ${v.name}`);
    }
  }

  printSilent(): void {
    const missing = this.sections
      .flatMap((s) => s.vars)
      .filter((v) => v.required && v.source === null && v.defaultValue === null)
      .map((v) => v.name);

    if (missing.length === 0) return;

    console.log("The following required variables are not configured:");
    for (const name of missing) {
      console.log(`  ${name}`);
    }
  }

  private statusChar(v: ResolvedVar): string {
    const { color } = this;
    if (v.source !== null) return color.ok("✓");
    if (!v.required || v.defaultValue !== null) return color.muted("—");
    return color.error("✗");
  }

  private sourceText(v: ResolvedVar): string {
    if (v.source !== null) return v.source;
    if (v.defaultValue !== null) return `(default: ${v.defaultValue})`;
    if (!v.required) return "(optional, not set)";
    return "(not set)";
  }
}

// ─── --explain template ──────────────────────────────────────────────────────

const TYPE_HINT_RE = /^<\w+>$/;

/** Colorize a single line of the --explain template output. */
function colorizeExplainLine(line: string, color: ColorPalette): string {
  if (!line.trim()) return line;

  // Comment lines (including optional # KEY=value)
  if (line.startsWith("#")) return color.comment(line);

  // KEY=... lines
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return line;

  const keyPart = line.slice(0, eqIdx);
  const afterEq = line.slice(eqIdx + 1);

  // Split value and inline comment (# ...)
  const hashIdx = afterEq.indexOf("#");
  const rawValue = hashIdx === -1 ? afterEq : afterEq.slice(0, hashIdx).trimEnd();
  const spacing = hashIdx === -1 ? "" : afterEq.slice(rawValue.length, hashIdx);
  const inlineComment = hashIdx === -1 ? "" : afterEq.slice(hashIdx);

  let coloredValue: string;
  if (!rawValue) {
    coloredValue = "";
  } else if (rawValue.trim() === "<secret>") {
    coloredValue = color.error(rawValue);
  } else if (TYPE_HINT_RE.test(rawValue.trim())) {
    coloredValue = color.typeHint(rawValue);
  } else {
    coloredValue = color.value(rawValue);
  }

  const coloredComment = inlineComment ? `${spacing}${color.comment(inlineComment)}` : "";
  return `${color.key(keyPart)}=${coloredValue}${coloredComment}`;
}

const EXPLAIN_TEMPLATE = `\
# check-env 格式说明
# 本文件展示 check-env 工具支持的完整 .env.example 语法
# 可直接复制作为新项目的 .env.example 起点
#
# 用法：check-env [--env dev|prod] [--silent] [--mismatch-only]

# ────────────────────────────────────────
# 必填变量（基础写法）
# ────────────────────────────────────────

# 无默认值，必须配置
REQUIRED_NO_DEFAULT=

# 有参考默认值（展示用，不自动注入）
REQUIRED_WITH_DEFAULT=5432

# ────────────────────────────────────────
# 类型提示
# ────────────────────────────────────────

# value 位置写 <type> 作为类型标记
PORT=<number>
ENABLE_FEATURE=<boolean>
API_ENDPOINT=<url>

# 也可通过 inline 注释说明类型和默认值
# default: X 表示应用内部有兜底值，未配置不报错
TIMEOUT=30    # number, unit: seconds, default: 30

# ────────────────────────────────────────
# 敏感变量（secret）
# ────────────────────────────────────────

# 方式一：value 写 <secret>，明确标记敏感
STRIPE_SK=<secret>

# 方式二：字段名含 KEY/SECRET/TOKEN/PASSWORD/PASS 自动识别
DATABASE_PASSWORD=
JWT_SECRET=

# ────────────────────────────────────────
# 可选变量（注释掉 key）
# ────────────────────────────────────────

# 注释掉整行 = 可选，未配置不报错
# FEATURE_FLAG=false
# WEBHOOK_URL=<url>
# OPTIONAL_SECRET=<secret>

# ────────────────────────────────────────
# 纯注释区段（无任何 key，check-env 会忽略此区段）
# ────────────────────────────────────────`;

function printExplain(color: ColorPalette): void {
  for (const line of EXPLAIN_TEMPLATE.split("\n")) {
    console.log(colorizeExplainLine(line, color));
  }
}

// ─── Help ────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`\
Usage: check-env [--env dev|prod] [flags]

Validates .env.example variables are configured in the current environment.
Reads .env.example from the current directory as the source of truth.

Options:
  -h, --help         Show this help message
  --env dev|prod     Environment to check (default: dev)
  --no-color         Disable color output
  --silent           Exit 1 with missing list if any required vars unset; exit 0 otherwise
  --mismatch-only    List only required-but-unset variables
  --explain          Print .env.example format reference template

Environment priority (dev):
  .env → .env.local → .env.development → .env.development.local

Environment priority (prod):
  .env → .env.production → .env.production.local

Exit codes:
  0  All required variables are configured (or --explain used)
  1  One or more required variables are missing, or .env.example not found
`);
}

// ─── CLI entry ───────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  let env: Env = "dev";
  let mode: "verbose" | "mismatch-only" | "silent" = "verbose";
  let explain = false;
  let noColor = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "--no-color") {
      noColor = true;
    } else if (arg === "--explain") {
      explain = true;
    } else if (arg === "--silent") {
      mode = "silent";
    } else if (arg === "--mismatch-only") {
      mode = "mismatch-only";
    } else if (arg === "--env") {
      const val = args[++i];
      if (val !== "dev" && val !== "prod") {
        console.error(`Error: --env must be "dev" or "prod"`);
        process.exit(1);
      }
      env = val;
    } else if (arg.startsWith("--env=")) {
      const val = arg.slice(6);
      if (val !== "dev" && val !== "prod") {
        console.error(`Error: --env must be "dev" or "prod"`);
        process.exit(1);
      }
      env = val;
    } else {
      console.error(`Error: unknown flag "${arg}"`);
      process.exit(1);
    }
  }

  const color = noColor ? new ColorPalette(false) : new ColorPalette();

  if (explain) {
    printExplain(color);
    process.exit(0);
  }

  if (!existsSync(".env.example")) {
    console.error("Error: .env.example not found in current directory");
    process.exit(1);
  }
  const checker = new EnvChecker({
    exampleContent: readFileSync(".env.example", "utf8"),
    envFiles: PRIORITY[env],
    color,
  });

  if (mode === "silent") {
    checker.printSilent();
    process.exit(checker.hasMissing() ? 1 : 0);
  }

  if (mode === "mismatch-only") {
    checker.printMismatchOnly();
    process.exit(checker.hasMissing() ? 1 : 0);
  }

  checker.printVerbose();
  process.exit(checker.hasMissing() ? 1 : 0);
}
