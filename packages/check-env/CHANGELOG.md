# @tigerbook/check-env

## 0.2.4

### Patch Changes

- 330986b: Translate the `check-env explain` reference template to English and keep the published CLI bundle minified.

## 0.2.3

### Patch Changes

- e315ec8: Infer number, boolean, and URL type hints from defaults and example values.

## 0.2.2

### Patch Changes

- 68cd237: Normalize published package repository metadata and refresh npm-visible README formatting.

## 0.2.1

### Patch Changes

- be666d7: chore: add homepage field pointing to package README on GitHub

## 0.2.0

### Minor Changes

- 74484cf: Add Node.js >= 22 compatibility. Both packages can now be installed via npm/pnpm/bun and run with Node in addition to Bun.

  - Replace Bun-specific APIs with Node >= 22 equivalents (`node:fs`, `node:child_process`)
  - Add `prepack` build step: compiles `src/index.ts` → `dist/index.js` with Node shebang before publish
  - Update README with install instructions for pnpm/bun/npm (pnpm and bun recommended for global install as they configure PATH automatically), global and per-project usage sections
