export const HELP_TEXT = `\
Usage: check-env [subcommand] [options]

Validates that all required environment variables declared in .env.example
are configured in the current environment. Type hints are validated by default.

Subcommands:
  check (default)    Validate env vars (standard output by default)
  get [KEY...]       Print KEY=VALUE lines for configured vars (all if no KEYS given)
  dump               Print full .env to stdout, or write to file with -o
  explain            Print .env.example format reference template

Global options:
  -h, --help             Show this help message
  -e, --env <name>       Environment to check (default: dev)
                         Built-in: dev, prod. Custom names infer their own file chain.
  -E, --example <path>   Path to .env.example (default: .env.example)
  --no-color             Disable color output

check options:
  -v, --verbose    Verbose — show values, source files, and section titles
  -q, --quiet      Compact — status symbol and key name only
  -s, --silent     No output on success; list errors on failure
  -m, --mismatch   List only missing required vars and type errors
  --no-mask        Show secret values unmasked

get options:
  --json           Output JSON instead of KEY=VALUE

dump options:
  -o, --output <file>  Write .env to file instead of stdout

Environment file priority:
  dev:      .env → .env.local → .env.development → .env.development.local
  prod:     .env → .env.production → .env.production.local
  <custom>: .env → .env.<name> → .env.<name>.local

Examples:
  check-env                              standard check (default)
  check-env -v                           verbose check with section titles
  check-env -e prod -s                   silent CI check for prod
  check-env check -q                     compact output
  check-env get                          all configured vars (KEY=VALUE)
  env \$(check-env get) node app.js       inject all vars into a subprocess
  check-env get DB_HOST DB_PORT          specific keys only
  check-env get --json                   JSON format for scripting
  check-env dump                         full .env to stdout
  check-env dump -o .env.snapshot        write snapshot to file
  check-env explain                      .env.example format reference

Exit codes:
  0  All checks pass (or explain / help used)
  1  Missing required vars, type errors, or .env.example not found
`;
