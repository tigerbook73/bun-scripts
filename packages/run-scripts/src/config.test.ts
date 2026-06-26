/**
 * @test-file   ConfigService
 * @description Unit tests for ConfigService: config loading, picker mode resolution, and init
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "./services/config";

/** Write a TOML config file, creating parent directories as needed. */
function writeConfig(path: string, toml: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, toml);
}

/**
 * @test-suite  ConfigService.load
 * @target      config file discovery and merging (global + local)
 * @strategy    unit, uses temp filesystem, overrides CWD via process.chdir to isolated dir
 * @cases
 *   - [PASS] returns empty object when no config files exist
 *   - [PASS] reads local config when only local config exists
 *   - [PASS] reads global config when only global config exists
 *   - [PASS] local config takes priority over global when both exist
 *   - [PASS] returns empty object when config file contains invalid TOML
 */
describe("ConfigService.load", () => {
  let tmpDir: string;
  let homeDir: string;
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "r-config-test-"));
    homeDir = join(tmpDir, "home");
    mkdirSync(homeDir);
    process.env.HOME = homeDir;
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(tmpDir, { recursive: true });
  });

  test("returns empty object when no config files exist", () => {
    const config = new ConfigService().load();
    expect(config).toEqual({});
  });

  test("reads local config when only local config exists", () => {
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[run-scripts]\npicker = "node"\n`);
    const config = new ConfigService().load();
    expect(config.picker).toBe("node");
  });

  test("reads global config when only global config exists", () => {
    writeConfig(join(homeDir, ".bun-scripts", "setting.toml"), `[run-scripts]\npicker = "node"\n`);
    const config = new ConfigService().load();
    expect(config.picker).toBe("node");
  });

  test("local config takes priority over global when both exist", () => {
    writeConfig(join(homeDir, ".bun-scripts", "setting.toml"), `[run-scripts]\npicker = "fzf"\n`);
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[run-scripts]\npicker = "node"\n`);
    const config = new ConfigService().load();
    expect(config.picker).toBe("node");
  });

  test("returns empty object when config file contains invalid TOML", () => {
    mkdirSync(join(tmpDir, ".bun-scripts"), { recursive: true });
    writeFileSync(join(tmpDir, ".bun-scripts", "setting.toml"), "not valid toml ][");
    const config = new ConfigService().load();
    expect(config.picker).toBeUndefined();
  });
});

/**
 * @test-suite  ConfigService.getPickerMode
 * @target      picker mode resolution from config
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] returns fzf by default when no picker is configured
 *   - [PASS] returns node when picker is set to node
 *   - [PASS] returns fzf when picker is explicitly set to fzf
 */
describe("ConfigService.getPickerMode", () => {
  const svc = new ConfigService();

  test("returns fzf by default when no picker is configured", () => {
    expect(svc.getPickerMode({})).toBe("fzf");
  });

  test("returns node when picker is set to node", () => {
    expect(svc.getPickerMode({ picker: "node" })).toBe("node");
  });

  test("returns fzf when picker is explicitly set to fzf", () => {
    expect(svc.getPickerMode({ picker: "fzf" })).toBe("fzf");
  });
});

/**
 * @test-suite  ConfigService.init
 * @target      config file and .gitignore creation
 * @strategy    unit, uses temp filesystem, chdir to isolated dir
 * @cases
 *   - [PASS] creates local setting.toml and .gitignore when not global
 *   - [PASS] local .gitignore contains * when created
 *   - [PASS] local setting.toml contains default picker fzf when created
 *   - [PASS] does not overwrite existing setting.toml when section already present
 */
describe("ConfigService.init", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "r-init-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("creates local setting.toml and .gitignore when not global", () => {
    new ConfigService().init(false);
    expect(existsSync(join(tmpDir, ".bun-scripts", "setting.toml"))).toBe(true);
    expect(existsSync(join(tmpDir, ".bun-scripts", ".gitignore"))).toBe(true);
  });

  test("local .gitignore contains * when created", () => {
    new ConfigService().init(false);
    const content = readFileSync(join(tmpDir, ".bun-scripts", ".gitignore"), "utf8");
    expect(content.trim()).toBe("*");
  });

  test("local setting.toml contains default picker fzf when created", () => {
    new ConfigService().init(false);
    const config = new ConfigService().load();
    expect(config.picker).toBe("fzf");
  });

  test("does not overwrite existing setting.toml when section already present", () => {
    writeConfig(join(tmpDir, ".bun-scripts", "setting.toml"), `[run-scripts]\npicker = "node"\n`);
    new ConfigService().init(false);
    const config = new ConfigService().load();
    expect(config.picker).toBe("node");
  });
});
