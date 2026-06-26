/**
 * @file lib/parser.ts
 * @description Parses .env.example files into typed sections,
 *   and .env files into key→value maps.
 */

import type { ExampleSection, ExampleVar } from "./types";

const SECRET_KEYWORDS = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PASS"];

export function isSecret(name: string, exampleValue: string | null): boolean {
  if (exampleValue === "<secret>") return true;
  const upper = name.toUpperCase();
  return SECRET_KEYWORDS.some((kw) => upper.includes(kw));
}

export function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****";
}

const ACTIVE_KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
const OPTIONAL_KEY_RE = /^#\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
const DEFAULT_VAL_RE = /\bdefault:\s*(\S+)/;
const TYPE_HINT_VALUE_RE = /^<(\w+)>$/;
const BOOLEAN_LITERALS = new Set(["true", "false", "yes", "no"]);

/**
 * Extracts `default: X` from the inline comment portion of a raw value string.
 * e.g. `30    # number, unit: seconds, default: 30` → `"30"`
 */
function extractDefaultValue(raw: string): string | null {
  const hashIdx = raw.indexOf("#");
  if (hashIdx === -1) return null;
  const comment = raw.slice(hashIdx + 1);
  const match = DEFAULT_VAL_RE.exec(comment);
  return match ? (match[1] ?? null) : null;
}

/**
 * Extracts the raw inline comment text (without leading `#` and space).
 * e.g. `30    # number, unit: seconds` → `"number, unit: seconds"`
 */
function extractInlineComment(raw: string): string | null {
  const hashIdx = raw.indexOf("#");
  if (hashIdx === -1) return null;
  return raw.slice(hashIdx + 1).trim() || null;
}

function inferTypeHint(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (BOOLEAN_LITERALS.has(trimmed.toLowerCase())) return "boolean";
  if (!isNaN(Number(trimmed))) return "number";
  try {
    new URL(trimmed);
    return "url";
  } catch {
    return null;
  }
}

/**
 * Extracts type hint from the value position, e.g. `<number>` → `"number"`.
 * If no explicit marker is present, infers from `default: X` first, then the
 * example value.
 */
function extractTypeHint(rawValue: string, defaultValue: string | null): string | null {
  const value = stripInlineComment(rawValue).trim();
  const match = TYPE_HINT_VALUE_RE.exec(value);
  if (match) {
    const hint = (match[1] ?? "").toLowerCase();
    return hint === "secret" ? null : hint;
  }
  return inferTypeHint(defaultValue) ?? inferTypeHint(value);
}

/** Strips inline comment and surrounding whitespace from a raw value string. */
export function stripInlineComment(raw: string): string {
  // Handle quoted values first — don't strip # inside quotes
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed.charAt(0);
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
        const name = match[1] ?? "";
        const rawValue = match[2] ?? "";
        const defaultValue = extractDefaultValue(rawValue);
        if (seenNames.has(name)) {
          console.error(`Warning: duplicate key "${name}" in .env.example — skipping duplicate`);
          continue;
        }
        seenNames.add(name);
        vars.push({
          name,
          required: true,
          exampleValue: null,
          defaultValue,
          isSecret: isSecret(name, stripInlineComment(rawValue)),
          inlineComment: extractInlineComment(rawValue),
          typeHint: extractTypeHint(rawValue, defaultValue),
        });
        continue;
      }
      match = OPTIONAL_KEY_RE.exec(line);
      if (match) {
        const name = match[1] ?? "";
        const rawValue = match[2] ?? "";
        const exampleValue = stripInlineComment(rawValue) || null;
        const defaultValue = extractDefaultValue(rawValue);
        if (seenNames.has(name)) continue; // commented alternative — silently skip
        seenNames.add(name);
        vars.push({
          name,
          required: false,
          exampleValue,
          defaultValue,
          isSecret: isSecret(name, exampleValue),
          inlineComment: extractInlineComment(rawValue),
          typeHint: extractTypeHint(rawValue, defaultValue),
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
