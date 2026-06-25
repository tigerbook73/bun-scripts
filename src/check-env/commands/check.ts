/**
 * @file commands/check.ts
 * @description "check" subcommand — validates that all required env vars are configured
 *   and prints results. Also exports the EnvChecker class for library use.
 */

import { existsSync, readFileSync } from "node:fs";
import type { ResolvedSection, ResolvedVar, CheckDisplay } from "../lib/types";
import type { ColorPalette } from "../lib/color";
import { makeColorPalette } from "../lib/color";
import { maskValue, parseEnvExample } from "../lib/parser";
import { resolveVars, getEnvFiles } from "../lib/resolver";

const VALUE_COL_MAX = 36;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export class EnvChecker {
  private readonly sections: ResolvedSection[];
  private readonly color: ColorPalette;

  constructor(options: { sections: ResolvedSection[]; color: ColorPalette }) {
    this.sections = options.sections;
    this.color = options.color;
  }

  private missingVars(): ResolvedVar[] {
    return this.sections
      .flatMap((s) => s.vars)
      .filter((v) => v.required && v.source === null && v.defaultValue === null);
  }

  private typeErrorVars(): ResolvedVar[] {
    return this.sections.flatMap((s) => s.vars).filter((v) => !v.typeValid);
  }

  hasMissing(): boolean {
    return this.missingVars().length > 0;
  }

  hasTypeErrors(): boolean {
    return this.typeErrorVars().length > 0;
  }

  /** Returns true if any required vars are missing OR any values fail type validation. */
  hasErrors(): boolean {
    return this.hasMissing() || this.hasTypeErrors();
  }

  printVerbose({ noMask = false }: { noMask?: boolean } = {}): void {
    const { sections, color } = this;

    const displayCache = new Map<ResolvedVar, string>();
    let maxKeyLen = 0;
    let maxValLen = 0;
    for (const s of sections) {
      for (const v of s.vars) {
        if (v.name.length > maxKeyLen) maxKeyLen = v.name.length;
        const vd = this.valueDisplay(v, noMask);
        displayCache.set(v, vd);
        if (vd.length > maxValLen) maxValLen = vd.length;
      }
    }
    maxValLen = Math.min(maxValLen, VALUE_COL_MAX);

    for (const [i, section] of sections.entries()) {
      if (section.title) {
        if (i > 0) process.stdout.write("\n");
        for (const line of section.title.split("\n")) {
          console.log(color.comment(line));
        }
      } else if (i > 0) {
        console.log("");
      }

      for (const v of section.vars) {
        const status = this.statusChar(v);
        const name = v.name.padEnd(maxKeyLen);
        const rawVal = displayCache.get(v) ?? "";
        const truncatedRaw = truncate(rawVal, maxValLen);
        const paddedRaw = truncatedRaw.padEnd(maxValLen);
        const coloredVal = v.value !== null ? paddedRaw : color.muted(paddedRaw);
        const src = v.source !== null ? color.muted(`# ${v.source}`) : "";
        console.log(`${status}  ${name}  ${coloredVal}  ${src}`.trimEnd());
      }
    }

    const typeErrors = this.typeErrorVars();
    if (typeErrors.length > 0) {
      console.log("");
      for (const v of typeErrors) {
        console.log(color.warn(`⚠  ${v.name}: "${v.value}" is not a valid <${v.typeHint}>`));
      }
    }
  }

  printQuiet(): void {
    const { sections } = this;
    for (const [i, section] of sections.entries()) {
      if (section.title && i > 0) process.stdout.write("\n");
      for (const v of section.vars) {
        console.log(`${this.statusChar(v)}  ${v.name}`);
      }
    }
  }

  printMismatchOnly(): void {
    const { color } = this;
    for (const v of this.missingVars()) {
      console.log(`${color.error("✗")}  ${v.name}`);
    }
    for (const v of this.typeErrorVars()) {
      console.log(`${color.warn("⚠")}  ${v.name}`);
    }
  }

  printSilent(): void {
    const groups: [string[], string][] = [
      [
        this.missingVars().map((v) => v.name),
        "The following required variables are not configured:",
      ],
      [this.typeErrorVars().map((v) => v.name), "The following variables fail type validation:"],
    ];

    if (groups.every(([names]) => names.length === 0)) return;

    for (const [names, header] of groups) {
      if (names.length > 0) {
        console.log(header);
        for (const name of names) console.log(`  ${name}`);
      }
    }
  }

  private statusChar(v: ResolvedVar): string {
    const { color } = this;
    if (v.source !== null) {
      if (!v.typeValid) return color.warn("⚠");
      return color.ok("✓");
    }
    if (!v.required || v.defaultValue !== null) return color.muted("—");
    return color.error("✗");
  }

  private valueDisplay(v: ResolvedVar, noMask: boolean): string {
    if (v.value !== null) {
      return v.isSecret && !noMask ? maskValue(v.value) : v.value;
    }
    if (v.defaultValue !== null) return `(default: ${v.defaultValue})`;
    if (!v.required) return "(optional)";
    return "(not set)";
  }
}

export function runCheck(args: {
  env: string;
  example: string;
  noColor: boolean;
  display: CheckDisplay;
  noMask: boolean;
}): void {
  const color = makeColorPalette(!args.noColor);
  if (!existsSync(args.example)) {
    console.error(`Error: ${args.example} not found in current directory`);
    process.exit(1);
  }
  const sections = resolveVars(
    parseEnvExample(readFileSync(args.example, "utf8")),
    getEnvFiles(args.env),
  );
  const checker = new EnvChecker({ sections, color });
  switch (args.display) {
    case "verbose":
      checker.printVerbose({ noMask: args.noMask });
      break;
    case "quiet":
      checker.printQuiet();
      break;
    case "silent":
      checker.printSilent();
      break;
    case "mismatch":
      checker.printMismatchOnly();
      break;
  }
  process.exit(checker.hasErrors() ? 1 : 0);
}
