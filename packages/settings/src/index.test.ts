/**
 * @test-file   settings
 * @description Unit tests for getLocalConfigPath, loadToolConfig, and initToolSection
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { GLOBAL_CONFIG_PATH, getLocalConfigPath, loadToolConfig, initToolSection } from "./index";

function writeConfig(path: string, toml: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, toml);
}

/**
 * @test-suite  getLocalConfigPath
 * @target      local config path resolution based on CWD
 * @strategy    unit, uses process.chdir to isolated temp dir
 * @cases
 *   - [PASS] returns path ending with .bun-scripts/setting.toml relative to CWD
 *   - [PASS] reflects new CWD after process.chdir
 */
describe("getLocalConfigPath", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "s-path-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("returns path ending with .bun-scripts/setting.toml relative to CWD", () => {
    expect(getLocalConfigPath()).toBe(join(tmpDir, ".bun-scripts", "setting.toml"));
  });

  test("reflects new CWD after process.chdir", () => {
    const subDir = join(tmpDir, "sub");
    mkdirSync(subDir);
    process.chdir(subDir);
    expect(getLocalConfigPath()).toBe(join(subDir, ".bun-scripts", "setting.toml"));
  });
});

/**
 * @test-suite  loadToolConfig
 * @target      tool config section loading and merging from global and local setting.toml
 * @strategy    unit, uses temp filesystem and process.chdir to isolate local config
 * @cases
 *   - [PASS] returns empty object when no config files exist
 *   - [PASS] returns empty object when tool section is absent from config
 *   - [PASS] reads tool section from local config
 *   - [PASS] reads tool section from global config
 *   - [PASS] local config takes priority over global for the same key
 *   - [PASS] deep merges nested objects from global and local configs
 *   - [PASS] returns empty object when config file contains invalid TOML
 */
describe("loadToolConfig", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "s-load-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("returns empty object when no config files exist", () => {
    expect(loadToolConfig("my-tool")).toEqual({});
  });

  test("returns empty object when tool section is absent from config", () => {
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[other-tool]\nkey = "val"\n`);
    expect(loadToolConfig("my-tool")).toEqual({});
  });

  test("reads tool section from local config", () => {
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[my-tool]\nfoo = "bar"\n`);
    expect(loadToolConfig<{ foo: string }>("my-tool")).toEqual({ foo: "bar" });
  });

  test("reads tool section from global config", () => {
    writeConfig(GLOBAL_CONFIG_PATH, `[my-tool]\nfoo = "global"\n`);
    try {
      expect(loadToolConfig<{ foo: string }>("my-tool")).toEqual({ foo: "global" });
    } finally {
      rmSync(GLOBAL_CONFIG_PATH);
    }
  });

  test("local config takes priority over global for the same key", () => {
    writeConfig(GLOBAL_CONFIG_PATH, `[my-tool]\nfoo = "global"\n`);
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[my-tool]\nfoo = "local"\n`);
    try {
      expect(loadToolConfig<{ foo: string }>("my-tool").foo).toBe("local");
    } finally {
      rmSync(GLOBAL_CONFIG_PATH);
    }
  });

  test("deep merges nested objects from global and local configs", () => {
    writeConfig(GLOBAL_CONFIG_PATH, `[my-tool.nested]\na = "from-global"\nb = "from-global"\n`);
    writeConfig(
      join(tmpDir, ".bun-scripts", "setting.toml"),
      `[my-tool.nested]\nb = "from-local"\n`,
    );
    try {
      const config = loadToolConfig<{ nested: { a: string; b: string } }>("my-tool");
      expect(config.nested?.a).toBe("from-global");
      expect(config.nested?.b).toBe("from-local");
    } finally {
      rmSync(GLOBAL_CONFIG_PATH);
    }
  });

  test("returns empty object when config file contains invalid TOML", () => {
    mkdirSync(join(tmpDir, ".bun-scripts"), { recursive: true });
    writeFileSync(join(tmpDir, ".bun-scripts", "setting.toml"), "not valid toml ][");
    expect(loadToolConfig("my-tool")).toEqual({});
  });
});

/**
 * @test-suite  initToolSection
 * @target      config file creation, appending, and .gitignore management
 * @strategy    unit, uses temp filesystem and process.chdir to isolate local config
 * @cases
 *   - [PASS] creates config file with content when file does not exist
 *   - [PASS] creates .gitignore in config dir when initializing local config
 *   - [PASS] .gitignore contains * when created for local config
 *   - [PASS] appends section when file exists but tool section is absent
 *   - [PASS] no-ops when tool section already exists in the config file
 *   - [PASS] does not create .gitignore when initializing global config
 *   - [PASS] does not overwrite existing .gitignore when one already exists
 */
describe("initToolSection", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "s-init-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("creates config file with content when file does not exist", () => {
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "bar"\n`);
    const configPath = join(tmpDir, ".bun-scripts", "setting.toml");
    expect(existsSync(configPath)).toBe(true);
    expect(readFileSync(configPath, "utf8")).toContain("[my-tool]");
  });

  test("creates .gitignore in config dir when initializing local config", () => {
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "bar"\n`);
    expect(existsSync(join(tmpDir, ".bun-scripts", ".gitignore"))).toBe(true);
  });

  test(".gitignore contains * when created for local config", () => {
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "bar"\n`);
    const content = readFileSync(join(tmpDir, ".bun-scripts", ".gitignore"), "utf8");
    expect(content.trim()).toBe("*");
  });

  test("appends section when file exists but tool section is absent", () => {
    const configPath = join(tmpDir, ".bun-scripts", "setting.toml");
    writeConfig(configPath, `[other-tool]\nkey = "val"\n`);
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "bar"\n`);
    const content = readFileSync(configPath, "utf8");
    expect(content).toContain("[other-tool]");
    expect(content).toContain("[my-tool]");
  });

  test("no-ops when tool section already exists in the config file", () => {
    const configPath = join(tmpDir, ".bun-scripts", "setting.toml");
    writeConfig(configPath, `[my-tool]\nfoo = "original"\n`);
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "new"\n`);
    const content = readFileSync(configPath, "utf8");
    expect(content).toContain("original");
    expect(content).not.toContain("new");
  });

  test("does not create .gitignore when initializing global config", () => {
    const globalGitignore = join(homedir(), ".bun-scripts", ".gitignore");
    const hadGitignore = existsSync(globalGitignore);
    writeConfig(GLOBAL_CONFIG_PATH, `[other-tool]\nkey = "val"\n`);
    try {
      initToolSection(true, "my-tool", `[my-tool]\nfoo = "bar"\n`);
      if (!hadGitignore) {
        expect(existsSync(globalGitignore)).toBe(false);
      }
    } finally {
      rmSync(GLOBAL_CONFIG_PATH);
    }
  });

  test("does not overwrite existing .gitignore when one already exists", () => {
    const gitignorePath = join(tmpDir, ".bun-scripts", ".gitignore");
    mkdirSync(join(tmpDir, ".bun-scripts"), { recursive: true });
    writeFileSync(gitignorePath, "existing\n");
    initToolSection(false, "my-tool", `[my-tool]\nfoo = "bar"\n`);
    expect(readFileSync(gitignorePath, "utf8")).toBe("existing\n");
  });
});
