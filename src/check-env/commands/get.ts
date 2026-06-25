/**
 * @file commands/get.ts
 * @description "get" subcommand — prints configured env vars as KEY=VALUE lines
 *   or as a JSON object. Aborts with exit 1 if any vars are missing or invalid.
 */

import { existsSync, readFileSync } from "node:fs";
import type { ResolvedSection, ResolvedVar } from "../lib/types";
import { makeColorPalette } from "../lib/color";
import { parseEnvExample } from "../lib/parser";
import { resolveVars, getEnvFiles } from "../lib/resolver";
import { EnvChecker } from "./check";

function selectVars(sections: ResolvedSection[], keys: string[]): ResolvedVar[] {
  const allVars = sections.flatMap((s) => s.vars);
  if (keys.length === 0) return allVars.filter((v) => v.value !== null);

  const varMap = new Map(allVars.map((v) => [v.name, v]));
  const result: ResolvedVar[] = [];

  for (const k of keys) {
    const v = varMap.get(k);
    if (!v) {
      process.stderr.write(`Warning: "${k}" is not defined in .env.example\n`);
      continue;
    }
    if (v.value !== null) result.push(v);
    // silently skip keys that exist in example but are not configured
  }

  return result;
}

/** Outputs KEY=VALUE lines for configured vars. Always uses actual values (no masking). */
export function buildGetOutput(sections: ResolvedSection[], keys: string[]): string {
  return selectVars(sections, keys)
    .map((v) => `${v.name}=${v.value ?? ""}`)
    .join("\n");
}

/** Outputs a JSON object of var names to their actual values. */
export function buildJsonOutput(sections: ResolvedSection[], keys: string[]): string {
  const obj: Record<string, string> = {};
  for (const v of selectVars(sections, keys)) {
    obj[v.name] = v.value ?? "";
  }
  return JSON.stringify(obj, null, 2);
}

export function runGet(args: {
  env: string;
  example: string;
  noColor: boolean;
  keys: string[];
  json: boolean;
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
  if (checker.hasMissing()) {
    checker.printSilent();
    process.exit(1);
  }
  if (checker.hasTypeErrors()) {
    checker.printMismatchOnly();
    process.exit(1);
  }
  const out = args.json
    ? buildJsonOutput(sections, args.keys)
    : buildGetOutput(sections, args.keys);
  if (out) console.log(out);
  process.exit(0);
}
