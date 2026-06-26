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
 * - If the first arg is a flag, forwards all args to the package manager.
 * - If the query matches no scripts, forwards it to the package manager as-is.
 *
 * Usage:
 *   r                    Open picker
 *   r <query>            Filter scripts by fuzzy query
 *   r <query> -- <args>  Pass extra args to the script
 *   r --config [init]    Init config file (local or global)
 *   r --help             Show this help
 */

import { runCli } from "./cli";

if (import.meta.main) {
  process.exit(await runCli());
}
