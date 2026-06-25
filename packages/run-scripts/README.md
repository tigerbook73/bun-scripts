# r — run-package-scripts

[![npm](https://img.shields.io/npm/v/@tigerbook/run-scripts)](https://www.npmjs.com/package/@tigerbook/run-scripts)
[![license](https://img.shields.io/npm/l/@tigerbook/run-scripts)](./package.json)

Fuzzy script picker for npm/pnpm/yarn/bun workspaces. Type `r` to browse and run any script across your entire monorepo — no need to remember package names, cd into subdirectories, or type `pnpm --filter` commands.

## Install

Global install is recommended — `r` is an interactive tool meant to be used anywhere.

```bash
# pnpm or bun (recommended — PATH is configured automatically)
pnpm add -g @tigerbook/run-scripts
bun add -g @tigerbook/run-scripts

# npm
npm install -g @tigerbook/run-scripts
```

> **npm PATH note:** If `r` is not found after `npm install -g`, run `npm config get prefix` to find
> the global bin directory and add `<prefix>/bin` to your `PATH`.

**Requirements:** Node >= 22 or Bun >= 1.0 · [fzf](https://github.com/junegunn/fzf) on your PATH

### Install fzf

```bash
# macOS
brew install fzf

# Linux
sudo apt install fzf

# Windows (winget)
winget install fzf
```

## Quick start

```bash
cd your-project

r          # open fzf — browse and run any script
r build    # filter to "build" scripts; runs directly if exactly one match
r api/dev  # run the "dev" script in the "api" workspace package
```

## Usage

```bash
r                    # open fzf picker with all scripts
r <query>            # filter scripts; run directly if exactly one match
r <query> -- <args>  # pass extra args to the matched script
r --help             # show help
```

## Monorepo support

Scripts from all workspace packages are collected and prefixed by package name:

```
api/build       → "build" script in the "api" workspace
web/dev         → "dev" script in the "web" workspace
root/lint       → "lint" script at the repo root
```

In a single-package repo, scripts are listed without a prefix.

## Fallback behavior

If the query matches no scripts, it is forwarded to the package manager as-is:

```bash
r tsc            # no script named "tsc" → runs: pnpm tsc
r add lodash     # → runs: pnpm add lodash
```

## Auto-detection

`r` automatically detects the package manager by checking for lock files:

| Lock file           | Package manager |
| ------------------- | --------------- |
| `pnpm-lock.yaml`    | pnpm            |
| `bun.lock`          | bun             |
| `yarn.lock`         | yarn            |
| `package-lock.json` | npm             |

Must be run from the project root (directory containing `package.json`).

## License

MIT
