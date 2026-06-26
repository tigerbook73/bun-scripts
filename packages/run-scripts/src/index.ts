#!/usr/bin/env -S bun --env-file /dev/null

/**
 * run-package-scripts (r)
 *
 * Fuzzy script picker for npm/pnpm/yarn/bun workspaces.
 *
 * - Auto-detects the package manager from lock files.
 * - Collects scripts from the root package.json and all workspace packages.
 * - In a monorepo, scripts are prefixed by package name (e.g. `api/build`);
 *   root-level scripts use the `root/` prefix.
 * - With no query, opens a picker. With a query, runs directly if there
 *   is exactly one fuzzy match, otherwise pre-fills the picker search.
 * - Picker uses fzf if available, otherwise falls back to @inquirer/search.
 * - If the query matches no scripts, forwards it to the package manager as-is.
 *
 * Usage:
 *   r                    Open picker
 *   r <query>            Filter scripts by fuzzy query
 *   r <query> -- <args>  Pass extra args to the script
 *   r --help             Show this help
 */

import { spawnSync } from "node:child_process";
import { detectPackageManager, fuzzyMatch } from "./detect";
import { collectScripts } from "./collect";
import { execute } from "./run";
import { pick } from "./picker";
import { loadConfig, getPickerMode } from "./config";

// Re-export public API used by tests
export { fuzzyMatch, parsePnpmWorkspace, detectPackageManager } from "./detect";
export { buildRunArgs } from "./run";
export { collectScripts } from "./collect";
export type { ScriptEntry } from "./collect";

function printHelp(): void {
  console.log(`\
Usage: r [query] [-- ...args]

Fuzzy script picker for npm/pnpm/yarn/bun workspaces.

Examples:
  r                  Open picker with all available scripts
  r build            Run the script matching "build" (direct if unique)
  r build -- --watch Pass extra args to the matched script
  r tsc              If no script matches, forwards to the package manager

Script naming in monorepos:
  api/build          Script "build" in workspace package "api"
  root/lint          Script "lint" at the repo root

Options:
  -h, --help         Show this help message

Picker:
  Uses fzf if available, otherwise falls back to @inquirer/search
`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pickerMode = getPickerMode(config);
  const pm = detectPackageManager();
  const query = process.argv[2] ?? "";
  const extra = process.argv.slice(3);
  const scriptsMap = collectScripts(pm);

  const list = Array.from(scriptsMap.keys());
  const candidates = query ? list.filter((k) => fuzzyMatch(k, query)) : list;

  let selected = "";

  if (query && scriptsMap.has(query)) {
    selected = query;
  } else if (candidates.length === 1) {
    selected = candidates[0] ?? "";
  }

  if (!selected) {
    if (query && candidates.length === 0) {
      const args = [query, ...extra];
      console.log(`\nNo matching scripts, trying: ${pm} ${args.join(" ")}\n`);
      const result = spawnSync(pm, args, { stdio: "inherit" });
      process.exit(result.status ?? 1);
    }
    selected = await pick(list, query, pickerMode);
  }

  if (selected) {
    execute(pm, scriptsMap, selected, extra);
  }
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
