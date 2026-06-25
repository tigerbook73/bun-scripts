# check-env

Validates that all required environment variables declared in `.env.example` are configured in the current environment.

## Usage

```bash
check-env                        # verbose check (dev environment)
check-env -e prod                # check production environment
check-env -e staging             # check a custom environment
check-env -q                     # quiet: symbol + key name only
check-env -s                     # silent: no output on success
check-env -m                     # list only missing/invalid vars
```

### Output modes

All output modes run the check first and exit 1 if any required vars are missing or type-invalid.

```bash
# Get values (KEY=VALUE lines, actual values, no masking)
check-env -g                     # all configured vars
check-env -g DB_HOST DB_PORT     # specific keys
check-env -g --json              # JSON format
env $(check-env -g) node app.js  # inject into subprocess environment

# Dump full .env file (mirrors .env.example structure with actual values)
check-env --dump                 # to stdout
check-env -o .env.production.local.full  # to file
```

## `.env.example` format

```bash
# Section title (comment lines before the first key)

REQUIRED_VAR=                    # required, no default
DB_PORT=5432                     # required, example value shown for reference
PORT=<number>                    # required, type hint — validated at check time
API_URL=<url>                    # required, URL validation
STRIPE_SK=<secret>               # required, marked as secret (masked in output)
API_KEY=                         # auto-detected as secret by name
TIMEOUT=30  # number, default: 30  # has app-level default — not reported as missing

# Optional variables (commented out)
# FEATURE_FLAG=false
# WEBHOOK_URL=<url>
```

Run `check-env --explain` for a full annotated format reference.

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
  --explain             Show .env.example format reference

Check modes:
  -q, --quiet           Symbol + key name only
  -s, --silent          No output on success
  -m, --mismatch        List only errors

Output modes:
  -g, --get [KEYS...]   KEY=VALUE lines (all vars if no keys given)
      --json            JSON output (with --get)
  -D, --dump            Full .env to stdout
  -o, --output <file>   Full .env to file

Modifier:
  --no-mask             Show secret values in check modes
```
