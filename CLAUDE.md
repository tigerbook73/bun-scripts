# bun-scripts Project Guide

This is a collection of Bun-based developer CLI tools. Default to using Bun instead of Node.js.

## Commands

- `bun run install:tools` — compile and symlink all tools defined in `tools.config.json`
- `bun test` — run tests
- `bun run lint` / `bun run lint:fix` — ESLint
- `bun run format` / `bun run format:check` — Prettier
- `bun run typecheck` — type-check without emitting

## Adding a New Tool

1. Create `src/<tool-name>.ts` with a `#!/usr/bin/env -S bun` shebang.
2. Add an entry to `tools.config.json`:
   ```json
   { "src": "src/<tool-name>.ts", "name": "<binary-name>", "dir": "~/.local/bin" }
   ```
3. Run `bun run install:tools` to install.

## Bun Conventions

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of jest or vitest
- `Bun.file` instead of `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` instead of execa
- `bun:sqlite` for SQLite; `Bun.redis` for Redis; `Bun.sql` for Postgres
- Bun automatically loads `.env` — don't use dotenv

## Testing

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```
