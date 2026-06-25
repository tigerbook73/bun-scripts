import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  fuzzyMatch,
  parsePnpmWorkspace,
  detectPackageManager,
  buildRunArgs,
  PackageScriptRunner,
} from "./index";

/** Write multiple files into a temp dir in one call */
function scaffold(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

describe("fuzzyMatch", () => {
  test("matches characters in order", () => {
    expect(fuzzyMatch("install:tools", "instal")).toBe(true);
  });

  test("matches exact string", () => {
    expect(fuzzyMatch("build", "build")).toBe(true);
  });

  test("matches non-consecutive characters", () => {
    expect(fuzzyMatch("lint:fix", "lf")).toBe(true);
  });

  test("returns false when characters are out of order", () => {
    expect(fuzzyMatch("abc", "cab")).toBe(false);
  });

  test("returns false when query has no match", () => {
    expect(fuzzyMatch("lint", "xyz")).toBe(false);
  });

  test("empty query always matches non-empty string", () => {
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  test("returns false for empty string with non-empty query", () => {
    expect(fuzzyMatch("", "a")).toBe(false);
  });
});

describe("parsePnpmWorkspace", () => {
  test("parses single-quoted entries", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n")).toEqual(["packages/*"]);
  });

  test("parses double-quoted entries", () => {
    expect(parsePnpmWorkspace('packages:\n  - "apps/*"\n')).toEqual(["apps/*"]);
  });

  test("parses unquoted entries", () => {
    expect(parsePnpmWorkspace("packages:\n  - packages/*\n")).toEqual(["packages/*"]);
  });

  test("parses multiple entries", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - 'apps/*'\n")).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  test("skips negation patterns", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - '!**/test/**'\n")).toEqual([
      "packages/*",
    ]);
  });

  test("stops at next top-level key", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\ncatalog:\n  react: ^18\n")).toEqual([
      "packages/*",
    ]);
  });

  test("returns empty array when no packages key", () => {
    expect(parsePnpmWorkspace("catalog:\n  react: ^18\n")).toEqual([]);
  });
});

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

  test("detects pnpm from pnpm-lock.yaml", () => {
    writeFileSync("pnpm-lock.yaml", "");
    expect(detectPackageManager()).toBe("pnpm");
  });

  test("detects bun from bun.lock", () => {
    writeFileSync("bun.lock", "");
    expect(detectPackageManager()).toBe("bun");
  });

  test("detects bun from bun.lockb", () => {
    writeFileSync("bun.lockb", "");
    expect(detectPackageManager()).toBe("bun");
  });

  test("detects yarn from yarn.lock", () => {
    writeFileSync("yarn.lock", "");
    expect(detectPackageManager()).toBe("yarn");
  });

  test("detects npm from package-lock.json", () => {
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

describe("buildRunArgs", () => {
  test("root script: run <script>", () => {
    expect(buildRunArgs("pnpm", null, "build", [])).toEqual(["run", "build"]);
  });

  test("root script passes extra args", () => {
    expect(buildRunArgs("pnpm", null, "build", ["--", "--watch"])).toEqual([
      "run",
      "build",
      "--",
      "--watch",
    ]);
  });

  test("pnpm workspace: --filter <name> run <script>", () => {
    expect(buildRunArgs("pnpm", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("bun workspace: same as pnpm", () => {
    expect(buildRunArgs("bun", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("yarn workspace: workspace <name> <script>", () => {
    expect(buildRunArgs("yarn", "@scope/foo", "build", [])).toEqual([
      "workspace",
      "@scope/foo",
      "build",
    ]);
  });

  test("npm workspace: run <script> --workspace=<name>", () => {
    expect(buildRunArgs("npm", "@scope/foo", "build", [])).toEqual([
      "run",
      "build",
      "--workspace=@scope/foo",
    ]);
  });
});

describe("PackageScriptRunner.getScriptsMap", () => {
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

  test("single package: scripts have no prefix", () => {
    scaffold(tmpDir, {
      "package.json": JSON.stringify({ scripts: { build: "tsc", test: "bun test" } }),
    });
    const map = new PackageScriptRunner().getScriptsMap();
    expect(map.has("build")).toBe(true);
    expect(map.has("test")).toBe(true);
    expect([...map.keys()].some((k) => k.startsWith("root/"))).toBe(false);
  });

  test("pnpm monorepo: root scripts use root/ prefix", () => {
    scaffold(tmpDir, {
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "package.json": JSON.stringify({ scripts: { lint: "eslint ." } }),
      "packages/foo/package.json": JSON.stringify({
        name: "@scope/foo",
        scripts: { build: "tsc" },
      }),
    });
    const map = new PackageScriptRunner().getScriptsMap();
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
    const map = new PackageScriptRunner().getScriptsMap();
    expect(map.get("web/dev")).toEqual({ filter: "@scope/web", script: "dev" });
  });

  test("shortName collision: uses full scoped name as prefix", () => {
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
    const map = new PackageScriptRunner().getScriptsMap();
    expect(map.has("@a/utils/build")).toBe(true);
    expect(map.has("@b/utils/test")).toBe(true);
    expect(map.has("utils/build")).toBe(false);
  });

  test("yarn monorepo: reads workspaces from package.json", () => {
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
    const map = new PackageScriptRunner().getScriptsMap();
    expect(map.has("root/lint")).toBe(true);
    expect(map.has("web/dev")).toBe(true);
  });
});
