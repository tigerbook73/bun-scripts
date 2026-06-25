# bun-scripts Project Guide

This is a monorepo of Bun-based developer CLI tools, managed with pnpm workspaces.

## Structure

```
packages/
  check-env/     @tigerbook/check-env
  run-scripts/   @tigerbook/run-scripts
```

## Commands

Run from the repo root:

- `pnpm test` — run all tests across packages
- `pnpm typecheck` — type-check all packages
- `pnpm run lint` / `pnpm run lint:check` — ESLint (fix / check-only)
- `pnpm run format` / `pnpm run format:check` — Prettier
- `pnpm run verify` — lint, format, typecheck, and tests

Or per-package (from `packages/<tool-name>/`):

- `bun test` — run tests for this package only
- `bun run typecheck` — type-check this package
- `bun run build` — compile to `dist/` for Node (required before publishing)

## Adding a New Tool

1. Create `packages/<tool-name>/src/index.ts` with a `#!/usr/bin/env -S bun` shebang.
2. Create `packages/<tool-name>/package.json` with `name`, `bin`, and `publishConfig`.
3. Create `packages/<tool-name>/tsconfig.json` extending `../../tsconfig.json`.
4. Add a `packages/<tool-name>/README.md` documenting usage and options.
5. Run `cd packages/<tool-name> && bun link` (once) to register the binary globally.

## Local Dev (bun link)

`bun link` links the package as-is — no build required. The `bin` field points to `src/index.ts`, which Bun executes directly.

## Publishing

```bash
cd packages/<tool-name>
pnpm publish
```

`prepack` runs automatically before publish, compiling `src/index.ts` → `dist/index.js` (Node-compatible, shebang: `#!/usr/bin/env node`). `publishConfig` overrides `bin` and `files` for the published tarball.

## Bun Conventions

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of jest or vitest
- Bun automatically loads `.env` — don't use dotenv
- Source code uses Node-compatible APIs (not Bun.\*) so published packages run on Node >= 22

## Testing

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

## Changesets

Before committing changes to any package under `packages/`, check whether the change affects published behavior (new features, bug fixes, CLI changes, dependency updates, or documentation visible on npm). If yes, run:

```bash
pnpm changeset
```

and include the generated `.changeset/*.md` file in the same commit.

Skip changeset for: CI config, tests, root-level tooling, `.gitignore`, and other files that don't affect the published package.

## Keeping Docs and Tests in Sync

When a CLI tool's commands, flags, arguments, or behavior change, always update **all** of the following together:

- **`printHelp()` / help text** — flag names, descriptions, defaults, examples
- **`packages/<tool-name>/README.md`** — usage examples and options table
- **Tests** — any test that asserts on output, flags, or behavior affected by the change
