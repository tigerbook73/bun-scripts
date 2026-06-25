# check-env

[![npm](https://img.shields.io/npm/v/@tigerbook/check-env)](https://www.npmjs.com/package/@tigerbook/check-env)
[![license](https://img.shields.io/npm/l/@tigerbook/check-env)](./package.json)

Validates that all required environment variables declared in `.env.example` are configured in the current environment. Secrets are masked, type hints are validated, and missing vars are reported clearly.

## Install

### Global

Installs `check-env` as a system-wide command.

```bash
# pnpm or bun (recommended — PATH is configured automatically)
pnpm add -g @tigerbook/check-env
bun add -g @tigerbook/check-env

# npm
npm install -g @tigerbook/check-env
```

> **npm PATH note:** If `check-env` is not found after install, run `npm config get prefix` to find
> the global bin directory and add `<prefix>/bin` to your `PATH`.

### Per-project

Install as a dev dependency and run via `npx` / `bunx`, or wire up to `package.json` scripts.

```bash
pnpm add -D @tigerbook/check-env
# or
npm install --save-dev @tigerbook/check-env
```

```json
// package.json
"scripts": {
  "predev": "check-env",
  "prestart": "check-env -e prod -s"
}
```

**Requirements:** Node >= 22 or Bun >= 1.0

## Quick start

```bash
# Add to your project
echo "DB_HOST=\nDB_PORT=5432\nSTRIPE_SK=<secret>" > .env.example

# Run check
check-env
```

Output:

```
✓  DB_HOST    localhost    # .env.local
✓  DB_PORT    5432         # .env
✗  STRIPE_SK  (not set)
```

Exit code `0` on success, `1` on missing or invalid vars.

## Usage

```bash
check-env                        # standard check (dev environment)
check-env -e prod                # check production environment
check-env -e staging             # check custom environment
check-env -v                     # verbose: show section titles
check-env -q                     # quiet: symbol + key name only
check-env -s                     # silent: no output on success, errors on failure
check-env -m                     # list only missing/invalid vars
```

### Subcommands

```bash
# Print configured values as KEY=VALUE
check-env get                    # all vars
check-env get DB_HOST DB_PORT    # specific keys
check-env get --json             # JSON format
env $(check-env get) node app.js # inject into subprocess

# Reconstruct full .env from example + actual values
check-env dump                   # to stdout
check-env dump -o .env.snapshot  # to file

# Show .env.example format reference
check-env explain
```

## `.env.example` format

```bash
# ── Database ──────────────────────────────
DB_HOST=                         # required
DB_PORT=5432                     # required, example value for reference
PORT=<number>                    # required, validated as number at runtime
API_URL=<url>                    # required, validated as URL
STRIPE_SK=<secret>               # required, masked in output
API_KEY=                         # auto-detected as secret by name (KEY/TOKEN/SECRET/PASSWORD)
TIMEOUT=30  # number, default: 30  # app has built-in default — not reported as missing

# Optional variables (commented out = not required)
# FEATURE_FLAG=false
# WEBHOOK_URL=<url>
```

Run `check-env explain` for a full annotated reference.

## Environment file priority

| Environment     | Files loaded (low → high priority)                                    |
| --------------- | --------------------------------------------------------------------- |
| `dev` (default) | `.env` → `.env.local` → `.env.development` → `.env.development.local` |
| `prod`          | `.env` → `.env.production` → `.env.production.local`                  |
| `<custom>`      | `.env` → `.env.<name>` → `.env.<name>.local`                          |

## Options

```
Global:
  -h, --help            Show help
  -e, --env <name>      Environment (default: dev)
  -E, --example <path>  Path to .env.example (default: .env.example)
  --no-color            Disable color output

Check modes:
  -v, --verbose         Show values, source files, and section titles
  -q, --quiet           Symbol + key name only
  -s, --silent          No output on success; list errors on failure
  -m, --mismatch        List only missing vars and type errors

Modifiers:
  --no-mask             Show secret values unmasked

get:
  --json                JSON output instead of KEY=VALUE

dump:
  -o, --output <file>   Write to file instead of stdout
```

## License

MIT
