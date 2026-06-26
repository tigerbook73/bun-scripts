/**
 * @file commands/explain.ts
 * @description "explain" subcommand — prints the .env.example format reference template.
 * Also provides printHelp(), used by the CLI parser for --help output.
 */

import type { ColorPalette } from "../lib/color";
import { makeColorPalette } from "../lib/color";
import { EXPLAIN_TEMPLATE } from "./explain-template";
import { HELP_TEXT } from "./help-text";

const TYPE_HINT_RE = /^<\w+>$/;

/** Colorize a single line of the explain template output. */
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

export function printExplain(color: ColorPalette): void {
  for (const line of EXPLAIN_TEMPLATE.split("\n")) {
    console.log(colorizeExplainLine(line, color));
  }
}

export function printHelp(): void {
  console.log(HELP_TEXT);
}

export function runExplain(args: { noColor: boolean }): void {
  const color = makeColorPalette(!args.noColor);
  printExplain(color);
  process.exit(0);
}
