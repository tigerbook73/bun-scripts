/**
 * @file commands/dump.ts
 * @description "dump" subcommand — reconstructs a full .env file from resolved sections,
 *   writing to stdout or a file. Aborts with exit 1 if any vars are missing or invalid.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ResolvedSection } from "../lib/types";
import { makeColorPalette } from "../lib/color";
import { parseEnvExample } from "../lib/parser";
import { resolveVars, getEnvFiles } from "../lib/resolver";
import { EnvChecker } from "./check";

/**
 * Reconstructs a full .env file content from resolved sections,
 * mirroring the .env.example structure with actual values substituted.
 *
 * - Required vars: written as KEY=value (actual value, or empty if unset)
 * - Optional vars that are configured: written as KEY=value
 * - Optional vars that are not configured: written as commented # KEY=exampleValue
 * - Section titles and inline comments are preserved.
 */
export function buildEnvContent(sections: ResolvedSection[]): string {
  const lines: string[] = [];

  for (const [i, section] of sections.entries()) {
    if (i > 0) lines.push("");

    if (section.title) {
      for (const line of section.title.split("\n")) {
        lines.push(line);
      }
    }

    for (const v of section.vars) {
      const suffix = v.inlineComment ? `  # ${v.inlineComment}` : "";

      if (!v.required && v.source === null) {
        // Optional, not configured: keep commented with example value
        const exVal = v.exampleValue ?? "";
        lines.push(`# ${v.name}=${exVal}${suffix}`);
      } else {
        // Required (set or placeholder), or optional but configured
        const val = v.value ?? "";
        lines.push(`${v.name}=${val}${suffix}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

export async function runDump(args: {
  env: string;
  example: string;
  noColor: boolean;
  outputFile: string | null;
}): Promise<void> {
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
  if (checker.hasMissing()) {
    checker.printSilent();
    process.exit(1);
  }
  if (checker.hasTypeErrors()) {
    checker.printMismatchOnly();
    process.exit(1);
  }
  const content = buildEnvContent(sections);
  if (args.outputFile !== null) {
    writeFileSync(args.outputFile, content);
  } else {
    process.stdout.write(content);
  }
  process.exit(0);
}
