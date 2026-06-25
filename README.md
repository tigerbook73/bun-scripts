# bun-scripts

A collection of Bun-based developer CLI tools.

## Installation

```bash
bun install
bun link
```

## Tools

| Binary      | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `check-env` | Validates that all required `.env.example` variables are configured in the current environment. |
| `r`         | Fuzzy script picker for npm/pnpm/yarn/bun workspaces, with monorepo support.                    |

See each tool's `README.md` under `src/<tool-name>/` for full usage.

## Development

```bash
bun run verify     # lint + format + typecheck + tests (parallel)
bun test           # run tests only
bun run lint       # lint (fix)
bun run format     # format (fix)
bun run typecheck  # type-check
```
