# bun-scripts Project Guide

This is a collection of Bun-based developer CLI tools. Default to using Bun instead of Node.js.

## Commands

- `bun test` — run tests
- `bun run lint` / `bun run lint:check` — ESLint (fix / check-only)
- `bun run format` / `bun run format:check` — Prettier
- `bun run typecheck` — type-check without emitting
- `bun run verify` — run lint, format, typecheck, and tests in parallel

## Adding a New Tool

1. Create `src/<tool-name>/index.ts` with a `#!/usr/bin/env -S bun` shebang.
2. Add an entry to `package.json` `bin`:
   ```json
   "<binary-name>": "src/<tool-name>/index.ts"
   ```
3. Add a `src/<tool-name>/README.md` documenting usage and options.
4. Run `bun link` (once) to register the package globally.

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
