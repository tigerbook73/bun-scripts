# r — run-package-scripts

Fuzzy script picker for npm/pnpm/yarn/bun workspaces. Auto-detects the package manager and collects scripts from the root and all workspace packages.

## Usage

```bash
r                    # open fzf picker with all scripts
r <query>            # filter scripts; run directly if exactly one match
r <query> -- <args>  # pass extra args to the matched script
r --help             # show help
```

## Script naming

In a monorepo, scripts are prefixed by package name:

```
api/build       → script "build" in workspace package "api"
web/dev         → script "dev" in workspace package "web"
root/lint       → script "lint" at the repo root
```

In a single-package repo, scripts are listed without prefix.

## Fallback behavior

- If the query matches no scripts, it is forwarded to the package manager as-is (e.g. `r tsc` → `pnpm tsc`).
- If no query is given, fzf opens with all available scripts.

## Requirements

- [`fzf`](https://github.com/junegunn/fzf) must be on your PATH.
- Must be run from the project root (directory containing `package.json` or `pnpm-workspace.yaml`).
