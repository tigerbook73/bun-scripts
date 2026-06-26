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

**Requirements:** Node >= 22 or Bun >= 1.0

**Picker:** Uses [fzf](https://github.com/junegunn/fzf) when available (with command preview), otherwise falls back to the built-in interactive prompt — no extra setup needed.

### Install fzf (optional, recommended)

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

r          # open picker — browse and run any script (fzf shows full command in preview)
r build    # filter to "build" scripts; runs directly if exactly one match
r api/dev  # run the "dev" script in the "api" workspace package
```

## Usage

```bash
r                    # open picker with all scripts
r <query>            # filter scripts; run directly if exactly one match
r <query> -- <args>  # pass extra args to the matched script
r --help             # show help
```

Before executing, `r` always prints the full command it will run:

```
Running: pnpm --filter @my/app run dev
```

## Monorepo support

Scripts from all workspace packages are collected and prefixed by package name:

```
api/build       → "build" script in the "api" workspace
web/dev         → "dev" script in the "web" workspace
root/lint       → "lint" script at the repo root
```

In a single-package repo, scripts are listed without a prefix.

![fzf picker with command preview](https://raw.githubusercontent.com/tigerbook73/bun-scripts/main/packages/run-scripts/assets/fzf-snapshot.png)

## Fallback behavior

If the first argument is a flag (starts with `-`), it is forwarded directly to the package manager without any script matching:

```bash
r --filter @scope/api dev   # → runs: pnpm --filter @scope/api dev
r -D lodash                 # → runs: pnpm -D lodash
```

If the query matches no scripts, it is also forwarded to the package manager as-is:

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

## Configuration

Config is stored in `.bun-scripts/setting.toml` (local) and `~/.bun-scripts/setting.toml` (global). Local takes priority.

Initialize with `r --config init`:

```bash
r --config init          # create local .bun-scripts/setting.toml
r --config init --global # create ~/.bun-scripts/setting.toml
```

Then edit the file directly — TOML supports comments, so each option is documented inline:

```toml
[run-scripts]
# Preferred picker: "fzf" (default, falls back to built-in if not on PATH) | "node" (always built-in)
picker = "fzf"
```

| Field                | Values              | Default | Description                                                                                                                  |
| -------------------- | ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `run-scripts.picker` | `"fzf"` \| `"node"` | `"fzf"` | Preferred picker. `"fzf"` falls back to the built-in prompt if fzf is not on PATH. `"node"` always uses the built-in prompt. |

## License

MIT
