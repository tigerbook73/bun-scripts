# bun-scripts

A collection of Bun-based developer CLI tools, compiled and symlinked to `~/.local/bin`.

## Installation

```bash
bun install
bun run install:tools
```

This compiles each tool defined in `tools.config.json` and places the binary in the configured directory.

## Tools

### `r` — run-package-scripts

Fuzzy script picker for mono/single-repo workspaces — run `r --help` for full usage.

## Adding a New Tool

1. Create `src/<tool-name>.ts` with a shebang:
   ```ts
   #!/usr/bin/env -S bun --env-file /dev/null
   ```
2. Add an entry to `tools.config.json`:
   ```json
   { "src": "src/<tool-name>.ts", "name": "<binary-name>", "dir": "~/.local/bin" }
   ```
3. Run `bun run install:tools`.

## Development

```bash
bun test           # run tests
bun run lint       # lint
bun run typecheck  # type-check
```
