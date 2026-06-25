#!/usr/bin/env -S bun --env-file /dev/null

/**
 * check-env
 *
 * Validates that all required environment variables declared in .env.example
 * are configured in the current dev/prod (or custom) environment.
 *
 * Run `check-env --help` for full usage.
 */

import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ColorPalette } from "./color";
import { EnvChecker } from "./checker";
import { parseEnvExample } from "./parser";
import { resolveVars } from "./resolver";
import { buildEnvContent } from "./writer";
import { buildGetOutput, buildJsonOutput } from "./getter";
import { printExplain, printHelp } from "./explain";

// Re-exports for library consumers and tests
export { isSecret, maskValue, parseEnvExample, parseEnvFile, stripInlineComment } from "./parser";
export { resolveVars } from "./resolver";
export { ColorPalette } from "./color";
export { EnvChecker } from "./checker";
export { buildEnvContent } from "./writer";
export { buildGetOutput, buildJsonOutput } from "./getter";
export type { ExampleVar, ExampleSection, ResolvedVar, ResolvedSection, Env } from "./types";

// ─── CLI mode types ───────────────────────────────────────────────────────────

type CheckDisplay = "verbose" | "quiet" | "silent" | "mismatch";

type CliMode =
  | { kind: "check"; display: CheckDisplay; noMask: boolean }
  | { kind: "get"; keys: string[]; json: boolean }
  | { kind: "dump"; toStdout: boolean; outputFile: string | null };

// ─── Env file chains ─────────────────────────────────────────────────────────

function getEnvFiles(env: string): string[] {
  if (env === "dev") return [".env", ".env.local", ".env.development", ".env.development.local"];
  if (env === "prod") return [".env", ".env.production", ".env.production.local"];
  return [".env", `.env.${env}`, `.env.${env}.local`];
}

// ─── CLI entry ───────────────────────────────────────────────────────────────

if (import.meta.main) {
  let values: ReturnType<typeof parseArgs<typeof PARSE_OPTIONS>>["values"];
  let positionals: string[];

  const PARSE_OPTIONS = {
    allowPositionals: true,
    options: {
      help: { type: "boolean" as const, short: "h" },
      env: { type: "string" as const, short: "e" },
      example: { type: "string" as const, short: "E" },
      "no-color": { type: "boolean" as const },
      explain: { type: "boolean" as const },
      // Check display modes
      quiet: { type: "boolean" as const, short: "q" },
      silent: { type: "boolean" as const, short: "s" },
      mismatch: { type: "boolean" as const, short: "m" },
      // Output modes
      get: { type: "boolean" as const, short: "g" },
      json: { type: "boolean" as const },
      dump: { type: "boolean" as const, short: "D" },
      output: { type: "string" as const, short: "o" },
      // Display modifier
      "no-mask": { type: "boolean" as const },
    },
  } as const;

  try {
    ({ values, positionals } = parseArgs({ args: process.argv.slice(2), ...PARSE_OPTIONS }));
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // ── Parse flags into a typed mode (validates conflicts in one place) ───────

  const mode = ((): CliMode => {
    const checkFlags = ["quiet", "silent", "mismatch"] as const;
    const activeCheck = checkFlags.filter((f) => values[f]);
    const isOutputMode = values.get || values.dump || values.output !== undefined;

    if (activeCheck.length > 1) {
      console.error(`Error: --${activeCheck[0]} and --${activeCheck[1]} cannot be combined`);
      process.exit(1);
    }
    if (activeCheck.length > 0 && isOutputMode) {
      const outputFlag = values.get ? "--get" : values.dump ? "--dump" : "--output";
      console.error(`Error: --${activeCheck[0]} cannot be combined with ${outputFlag}`);
      process.exit(1);
    }
    if (values.get && (values.dump || values.output !== undefined)) {
      console.error(`Error: --get cannot be combined with ${values.dump ? "--dump" : "--output"}`);
      process.exit(1);
    }
    if (values.json && !values.get) {
      console.error("Error: --json requires --get / -g");
      process.exit(1);
    }
    if (positionals.length > 0 && !values.get) {
      console.error("Error: positional arguments require --get / -g");
      process.exit(1);
    }

    if (values.get) return { kind: "get", keys: positionals, json: values.json ?? false };
    if (values.dump || values.output !== undefined) {
      return { kind: "dump", toStdout: values.dump ?? false, outputFile: values.output ?? null };
    }
    return { kind: "check", display: activeCheck[0] ?? "verbose", noMask: values["no-mask"] ?? false };
  })();

  // ─────────────────────────────────────────────────────────────────────────

  const color = new ColorPalette(!values["no-color"]);

  if (values.explain) {
    printExplain(color);
    process.exit(0);
  }

  const examplePath = values.example ?? ".env.example";
  if (!existsSync(examplePath)) {
    console.error(`Error: ${examplePath} not found in current directory`);
    process.exit(1);
  }

  const sections = resolveVars(
    parseEnvExample(readFileSync(examplePath, "utf8")),
    getEnvFiles(values.env ?? "dev"),
  );
  const checker = new EnvChecker({ sections, color });

  switch (mode.kind) {
    case "get": {
      if (checker.hasMissing()) { checker.printSilent(); process.exit(1); }
      if (checker.hasTypeErrors()) { checker.printMismatchOnly(); process.exit(1); }
      const out = mode.json ? buildJsonOutput(sections, mode.keys) : buildGetOutput(sections, mode.keys);
      if (out) console.log(out);
      process.exit(0);
    }
    case "dump": {
      if (checker.hasMissing()) { checker.printSilent(); process.exit(1); }
      if (checker.hasTypeErrors()) { checker.printMismatchOnly(); process.exit(1); }
      const content = buildEnvContent(sections);
      if (mode.toStdout) process.stdout.write(content);
      if (mode.outputFile !== null) await Bun.write(mode.outputFile, content);
      process.exit(0);
    }
    case "check": {
      switch (mode.display) {
        case "verbose": checker.printVerbose({ noMask: mode.noMask }); break;
        case "quiet":   checker.printQuiet(); break;
        case "silent":  checker.printSilent(); break;
        case "mismatch": checker.printMismatchOnly(); break;
      }
      process.exit(checker.hasErrors() ? 1 : 0);
    }
  }
}
