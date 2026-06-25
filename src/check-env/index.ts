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
import { ColorPalette } from "./color";
import { EnvChecker } from "./checker";
import { printExplain, printHelp } from "./explain";
import type { Env } from "./types";

// Re-exports for library consumers and tests
export { isSecret, maskValue, parseEnvExample, parseEnvFile } from "./parser";
export { resolveVars } from "./resolver";
export { ColorPalette } from "./color";
export { EnvChecker } from "./checker";
export type { ExampleVar, ExampleSection, ResolvedVar, ResolvedSection, Env } from "./types";

// ─── Priority chains ─────────────────────────────────────────────────────────

const PRIORITY: Record<Env, string[]> = {
  dev: [".env", ".env.local", ".env.development", ".env.development.local"],
  prod: [".env", ".env.production", ".env.production.local"],
};

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
    } else if (arg === "--env" || arg.startsWith("--env=")) {
      const val = arg.startsWith("--env=") ? arg.slice(6) : args[++i];
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
