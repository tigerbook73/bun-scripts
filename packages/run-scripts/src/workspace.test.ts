/**
 * @test-file   WorkspaceService
 * @description Unit tests for WorkspaceService: PM detection and workspace script collection
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { WorkspaceService } from "./services/workspace";

/** Write multiple files into a temp dir in one call */
function scaffold(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

/**
 * @test-suite  WorkspaceService.detectPm
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
describe("WorkspaceService.detectPm", () => {
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
    expect(new WorkspaceService().detectPm()).toBe("pnpm");
  });

  test("detects bun from bun.lock when bun.lock exists", () => {
    writeFileSync("bun.lock", "");
    expect(new WorkspaceService().detectPm()).toBe("bun");
  });

  test("detects bun from bun.lockb when bun.lockb exists", () => {
    writeFileSync("bun.lockb", "");
    expect(new WorkspaceService().detectPm()).toBe("bun");
  });

  test("detects yarn from yarn.lock when yarn.lock exists", () => {
    writeFileSync("yarn.lock", "");
    expect(new WorkspaceService().detectPm()).toBe("yarn");
  });

  test("detects npm from package-lock.json when package-lock.json exists", () => {
    writeFileSync("package-lock.json", "{}");
    expect(new WorkspaceService().detectPm()).toBe("npm");
  });

  test("defaults to npm when no lock file found", () => {
    expect(new WorkspaceService().detectPm()).toBe("npm");
  });

  test("pnpm takes priority over yarn when both present", () => {
    writeFileSync("pnpm-lock.yaml", "");
    writeFileSync("yarn.lock", "");
    expect(new WorkspaceService().detectPm()).toBe("pnpm");
  });
});

/**
 * @test-suite  WorkspaceService.collectScripts
 * @target      script collection from package.json and workspace packages
 * @strategy    unit, uses temp filesystem, chdir to isolated dir
 * @cases
 *   - [PASS] single package: scripts have no prefix when no workspace config
 *   - [PASS] pnpm monorepo: root scripts use root/ prefix when workspace is configured
 *   - [PASS] monorepo workspace script points to correct package filter
 *   - [PASS] shortName collision: uses full scoped name as prefix when two packages share a short name
 *   - [PASS] yarn monorepo: reads workspaces from package.json when using yarn
 */
describe("WorkspaceService.collectScripts", () => {
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
    const map = new WorkspaceService().collectScripts();
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
    const map = new WorkspaceService().collectScripts();
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
    const map = new WorkspaceService().collectScripts();
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
    const map = new WorkspaceService().collectScripts();
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
    const map = new WorkspaceService().collectScripts();
    expect(map.has("root/lint")).toBe(true);
    expect(map.has("web/dev")).toBe(true);
  });
});
