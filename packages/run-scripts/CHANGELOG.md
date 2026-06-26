# @tigerbook/run-scripts

## 0.3.0

### Minor Changes

- 330986b: Add built-in interactive picker fallback when fzf is not available. Uses a local fork of @inquirer/search with initialInput pre-fill and Escape-to-clear/cancel support. Always prints the full command before execution. When fzf is used, shows the full command in a preview window. Adds config file support (`~/.bun-scripts/setting.toml` and `.bun-scripts/setting.toml`) with `run-scripts.picker` option to prefer `"fzf"` or `"node"`.

## 0.2.3

### Patch Changes

- 68cd237: Normalize published package repository metadata and refresh npm-visible README formatting.

## 0.2.2

### Patch Changes

- 2e25d96: chore: add homepage field pointing to package README on GitHub

## 0.2.1

### Patch Changes

- d2c8ab3: docs: simplify fzf Linux install note and fix table alignment in README

## 0.2.0

### Minor Changes

- 74484cf: Add Node.js >= 22 compatibility. Both packages can now be installed via npm/pnpm/bun and run with Node in addition to Bun.

  - Replace Bun-specific APIs with Node >= 22 equivalents (`node:fs`, `node:child_process`)
  - Add `prepack` build step: compiles `src/index.ts` → `dist/index.js` with Node shebang before publish
  - Update README with install instructions for pnpm/bun/npm (pnpm and bun recommended for global install as they configure PATH automatically), global and per-project usage sections
