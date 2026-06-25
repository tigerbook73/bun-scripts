#!/usr/bin/env -S bun --env-file /dev/null

/**
 * @file index.ts
 * @description CLI entry point for check-env. Parses argv into a typed discriminated union,
 *   dispatches to the appropriate subcommand, and re-exports the public library API.
 *
 * Run `check-env --help` for full usage.
 */

import { parseArgs } from "node:util";
import type { CheckDisplay } from "./lib/types";
import { printHelp, runExplain } from "./commands/explain";
import { runCheck } from "./commands/check";
import { runGet } from "./commands/get";
import { runDump } from "./commands/dump";

// Re-exports for library consumers and tests
export {
  isSecret,
  maskValue,
  parseEnvExample,
  parseEnvFile,
  stripInlineComment,
} from "./lib/parser";
export { resolveVars } from "./lib/resolver";
export { makeColorPalette } from "./lib/color";
export type { ColorPalette } from "./lib/color";
export { EnvChecker } from "./commands/check";
export { buildEnvContent } from "./commands/dump";
export { buildGetOutput, buildJsonOutput } from "./commands/get";
export type { ExampleVar, ExampleSection, ResolvedVar, ResolvedSection, Env } from "./lib/types";

// ─── ParsedArgs discriminated union ──────────────────────────────────────────

type ParsedArgs =
  | {
      sub: "check";
      env: string;
      example: string;
      noColor: boolean;
      display: CheckDisplay;
      noMask: boolean;
    }
  | { sub: "get"; env: string; example: string; noColor: boolean; keys: string[]; json: boolean }
  | { sub: "dump"; env: string; example: string; noColor: boolean; outputFile: string | null }
  | { sub: "explain"; noColor: boolean };

const SUBCOMMANDS = ["check", "get", "dump", "explain"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

// ─── CLI parser ───────────────────────────────────────────────────────────────

function parseCliArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const PARSE_OPTIONS = {
    allowPositionals: true,
    options: {
      env: { type: "string" as const, short: "e" },
      example: { type: "string" as const, short: "E" },
      "no-color": { type: "boolean" as const },
      // check options
      verbose: { type: "boolean" as const, short: "v" },
      quiet: { type: "boolean" as const, short: "q" },
      silent: { type: "boolean" as const, short: "s" },
      mismatch: { type: "boolean" as const, short: "m" },
      "no-mask": { type: "boolean" as const },
      // get options
      json: { type: "boolean" as const },
      // dump options
      output: { type: "string" as const, short: "o" },
    },
  } as const;

  let values: ReturnType<typeof parseArgs<typeof PARSE_OPTIONS>>["values"];
  let positionals: string[];

  try {
    ({ values, positionals } = parseArgs({ args: argv, ...PARSE_OPTIONS }));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const [firstPositional = "", ...restPositionals] = positionals;
  const isKnownSub = (SUBCOMMANDS as readonly string[]).includes(firstPositional);
  const sub: Subcommand = isKnownSub ? (firstPositional as Subcommand) : "check";
  const subPositionals = isKnownSub ? restPositionals : positionals;

  const env = values.env ?? "dev";
  const example = values.example ?? ".env.example";
  const noColor = values["no-color"] ?? false;

  switch (sub) {
    case "explain":
      return { sub: "explain", noColor };

    case "get":
      return {
        sub: "get",
        env,
        example,
        noColor,
        keys: subPositionals,
        json: values.json ?? false,
      };

    case "dump":
      if (subPositionals.length > 0) {
        console.error(`Error: "dump" takes no positional arguments`);
        process.exit(1);
      }
      return { sub: "dump", env, example, noColor, outputFile: values.output ?? null };

    case "check": {
      if (subPositionals.length > 0) {
        console.error(`Error: unexpected arguments: ${subPositionals.join(", ")}`);
        process.exit(1);
      }
      const checkFlags = ["verbose", "quiet", "silent", "mismatch"] as const;
      const activeCheck = checkFlags.filter((f) => values[f]);
      if (activeCheck.length > 1) {
        console.error(`Error: --${activeCheck[0]} and --${activeCheck[1]} cannot be combined`);
        process.exit(1);
      }
      return {
        sub: "check",
        env,
        example,
        noColor,
        display: activeCheck[0] ?? "standard",
        noMask: values["no-mask"] ?? false,
      };
    }
  }
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = parseCliArgs(process.argv.slice(2));
  switch (args.sub) {
    case "check":
      runCheck(args);
      break;
    case "get":
      runGet(args);
      break;
    case "dump":
      await runDump(args);
      break;
    case "explain":
      runExplain(args);
      break;
  }
}
