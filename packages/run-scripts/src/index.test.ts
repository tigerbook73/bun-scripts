/**
 * @test-file   run-scripts
 * @description Unit tests for detect, collect, and run modules: fuzzyMatch, parsePnpmWorkspace, detectPackageManager, buildRunArgs, collectScripts
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  fuzzyMatch,
  parsePnpmWorkspace,
  detectPackageManager,
  buildRunArgs,
  collectScripts,
} from "./index";

/** Write multiple files into a temp dir in one call */
function scaffold(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

/**
 * @test-suite  fuzzyMatch
 * @target      fuzzy character-sequence matching
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] matches characters in order when query is a prefix substring
 *   - [PASS] matches exact string when query equals the full string
 *   - [PASS] matches non-consecutive characters when they appear in order
 *   - [FAIL] returns false when characters are out of order
 *   - [FAIL] returns false when query has no match in string
 *   - [PASS] empty query always matches non-empty string
 *   - [FAIL] returns false for empty string with non-empty query
 */
describe("fuzzyMatch", () => {
  test("matches characters in order when query is a prefix substring", () => {
    expect(fuzzyMatch("install:tools", "instal")).toBe(true);
  });

  test("matches exact string when query equals the full string", () => {
    expect(fuzzyMatch("build", "build")).toBe(true);
  });

  test("matches non-consecutive characters when they appear in order", () => {
    expect(fuzzyMatch("lint:fix", "lf")).toBe(true);
  });

  test("returns false when characters are out of order", () => {
    expect(fuzzyMatch("abc", "cab")).toBe(false);
  });

  test("returns false when query has no match in string", () => {
    expect(fuzzyMatch("lint", "xyz")).toBe(false);
  });

  test("empty query always matches non-empty string", () => {
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  test("returns false for empty string with non-empty query", () => {
    expect(fuzzyMatch("", "a")).toBe(false);
  });
});

/**
 * @test-suite  parsePnpmWorkspace
 * @target      pnpm-workspace.yaml package list parsing
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] parses single-quoted entries when yaml uses single quotes
 *   - [PASS] parses double-quoted entries when yaml uses double quotes
 *   - [PASS] parses unquoted entries when yaml has no quotes
 *   - [PASS] parses multiple entries when packages list has multiple items
 *   - [PASS] skips negation patterns when entry starts with !
 *   - [PASS] stops at next top-level key when packages block ends
 *   - [PASS] returns empty array when no packages key is present
 */
describe("parsePnpmWorkspace", () => {
  test("parses single-quoted entries when yaml uses single quotes", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n")).toEqual(["packages/*"]);
  });

  test("parses double-quoted entries when yaml uses double quotes", () => {
    expect(parsePnpmWorkspace('packages:\n  - "apps/*"\n')).toEqual(["apps/*"]);
  });

  test("parses unquoted entries when yaml has no quotes", () => {
    expect(parsePnpmWorkspace("packages:\n  - packages/*\n")).toEqual(["packages/*"]);
  });

  test("parses multiple entries when packages list has multiple items", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - 'apps/*'\n")).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  test("skips negation patterns when entry starts with !", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - '!**/test/**'\n")).toEqual([
      "packages/*",
    ]);
  });

  test("stops at next top-level key when packages block ends", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\ncatalog:\n  react: ^18\n")).toEqual([
      "packages/*",
    ]);
  });

  test("returns empty array when no packages key is present", () => {
    expect(parsePnpmWorkspace("catalog:\n  react: ^18\n")).toEqual([]);
  });
});

/**
 * @test-suite  detectPackageManager
 * @target      package manager detection from lock files
 * @strategy    unit, uses temp filesystem, chdir to isolated dir
 * @cases
 *   - [PASS] detects pnpm from pnpm-lock.yaml when pnpm-lock.yaml exists
 *   - [PASS] detects bun from bun.lock when bun.lock exists
 *   - [PASS] detects bun from bun.lockb when bun.lockb exists
 *   - [PASS] detects yarn from yarn.lock when yarn.lock exists
 *   - [PASS] detects npm from package-lock.json when package-lock.json exists
 *   - [PASS] defaults to npm when no lock file found
 *   - [PASS] pnpm takes priority over yarn when both present
 */
describe("detectPackageManager", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "r-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("detects pnpm from pnpm-lock.yaml when pnpm-lock.yaml exists", () => {
    writeFileSync("pnpm-lock.yaml", "");
    expect(detectPackageManager()).toBe("pnpm");
  });

  test("detects bun from bun.lock when bun.lock exists", () => {
    writeFileSync("bun.lock", "");
    expect(detectPackageManager()).toBe("bun");
  });

  test("detects bun from bun.lockb when bun.lockb exists", () => {
    writeFileSync("bun.lockb", "");
    expect(detectPackageManager()).toBe("bun");
  });

  test("detects yarn from yarn.lock when yarn.lock exists", () => {
    writeFileSync("yarn.lock", "");
    expect(detectPackageManager()).toBe("yarn");
  });

  test("detects npm from package-lock.json when package-lock.json exists", () => {
    writeFileSync("package-lock.json", "{}");
    expect(detectPackageManager()).toBe("npm");
  });

  test("defaults to npm when no lock file found", () => {
    expect(detectPackageManager()).toBe("npm");
  });

  test("pnpm takes priority over yarn when both present", () => {
    writeFileSync("pnpm-lock.yaml", "");
    writeFileSync("yarn.lock", "");
    expect(detectPackageManager()).toBe("pnpm");
  });
});

/**
 * @test-suite  buildRunArgs
 * @target      package manager command argument construction
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] root script: run <script> when filter is null
 *   - [PASS] root script passes extra args when extra args are provided
 *   - [PASS] pnpm workspace: --filter <name> run <script> for pnpm
 *   - [PASS] bun workspace: same as pnpm for bun
 *   - [PASS] yarn workspace: workspace <name> <script> for yarn
 *   - [PASS] npm workspace: run <script> --workspace=<name> for npm
 */
describe("buildRunArgs", () => {
  test("root script: run <script> when filter is null", () => {
    expect(buildRunArgs("pnpm", null, "build", [])).toEqual(["run", "build"]);
  });

  test("root script passes extra args when extra args are provided", () => {
    expect(buildRunArgs("pnpm", null, "build", ["--", "--watch"])).toEqual([
      "run",
      "build",
      "--",
      "--watch",
    ]);
  });

  test("pnpm workspace: --filter <name> run <script> for pnpm", () => {
    expect(buildRunArgs("pnpm", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("bun workspace: same as pnpm for bun", () => {
    expect(buildRunArgs("bun", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("yarn workspace: workspace <name> <script> for yarn", () => {
    expect(buildRunArgs("yarn", "@scope/foo", "build", [])).toEqual([
      "workspace",
      "@scope/foo",
      "build",
    ]);
  });

  test("npm workspace: run <script> --workspace=<name> for npm", () => {
    expect(buildRunArgs("npm", "@scope/foo", "build", [])).toEqual([
      "run",
      "build",
      "--workspace=@scope/foo",
    ]);
  });
});

/**
 * @test-suite  collectScripts
 * @target      script collection from package.json and workspace packages
 * @strategy    unit, uses temp filesystem, chdir to isolated dir
 * @cases
 *   - [PASS] single package: scripts have no prefix when no workspace config
 *   - [PASS] pnpm monorepo: root scripts use root/ prefix when workspace is configured
 *   - [PASS] monorepo workspace script points to correct package filter
 *   - [PASS] shortName collision: uses full scoped name as prefix when two packages share a short name
 *   - [PASS] yarn monorepo: reads workspaces from package.json when using yarn
 */
describe("collectScripts", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "r-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("single package: scripts have no prefix when no workspace config", () => {
    scaffold(tmpDir, {
      "package.json": JSON.stringify({ scripts: { build: "tsc", test: "bun test" } }),
    });
    const map = collectScripts(detectPackageManager());
    expect(map.has("build")).toBe(true);
    expect(map.has("test")).toBe(true);
    expect([...map.keys()].some((k) => k.startsWith("root/"))).toBe(false);
  });

  test("pnpm monorepo: root scripts use root/ prefix when workspace is configured", () => {
    scaffold(tmpDir, {
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "package.json": JSON.stringify({ scripts: { lint: "eslint ." } }),
      "packages/foo/package.json": JSON.stringify({
        name: "@scope/foo",
        scripts: { build: "tsc" },
      }),
    });
    const map = collectScripts(detectPackageManager());
    expect(map.has("root/lint")).toBe(true);
    expect(map.has("foo/build")).toBe(true);
    expect(map.has("lint")).toBe(false);
  });

  test("monorepo workspace script points to correct package filter", () => {
    scaffold(tmpDir, {
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "package.json": JSON.stringify({}),
      "packages/web/package.json": JSON.stringify({
        name: "@scope/web",
        scripts: { dev: "vite" },
      }),
    });
    const map = collectScripts(detectPackageManager());
    expect(map.get("web/dev")).toEqual({ filter: "@scope/web", script: "dev" });
  });

  test("shortName collision: uses full scoped name as prefix when two packages share a short name", () => {
    scaffold(tmpDir, {
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "package.json": JSON.stringify({}),
      "packages/a/package.json": JSON.stringify({
        name: "@a/utils",
        scripts: { build: "tsc" },
      }),
      "packages/b/package.json": JSON.stringify({
        name: "@b/utils",
        scripts: { test: "bun test" },
      }),
    });
    const map = collectScripts(detectPackageManager());
    expect(map.has("@a/utils/build")).toBe(true);
    expect(map.has("@b/utils/test")).toBe(true);
    expect(map.has("utils/build")).toBe(false);
  });

  test("yarn monorepo: reads workspaces from package.json when using yarn", () => {
    scaffold(tmpDir, {
      "yarn.lock": "",
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
        scripts: { lint: "eslint ." },
      }),
      "packages/web/package.json": JSON.stringify({
        name: "web",
        scripts: { dev: "vite" },
      }),
    });
    const map = collectScripts(detectPackageManager());
    expect(map.has("root/lint")).toBe(true);
    expect(map.has("web/dev")).toBe(true);
  });
});
