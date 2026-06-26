/**
 * @test-file   config
 * @description Unit tests for config loading, merging, picker mode resolution, and initSetting
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { loadConfig, getPickerMode, initSetting } from "./config";

/** Write a JSON config file, creating parent directories as needed. */
function writeConfig(path: string, data: object): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

/**
 * @test-suite  loadConfig
 * @target      config file discovery and merging (global + local)
 * @strategy    unit, uses temp filesystem, overrides HOME via chdir to isolated dir
 * @cases
 *   - [PASS] returns empty config when no config files exist
 *   - [PASS] reads global config when only global config exists
 *   - [PASS] reads local config when only local config exists
 *   - [PASS] local config takes priority over global when both exist
 *   - [PASS] returns empty config when config file contains invalid JSON
 */
describe("loadConfig", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "r-config-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
  });

  test("returns empty config when no config files exist", () => {
    const config = loadConfig();
    expect(config).toEqual({ "run-scripts": {} });
  });

  test("reads local config when only local config exists", () => {
    writeConfig(join(tmpDir, ".bun-scripts", "setting.json"), {
      "run-scripts": { picker: "inquirer" },
    });
    const config = loadConfig();
    expect(config["run-scripts"]?.picker).toBe("inquirer");
  });

  test("reads global config when only global config exists", () => {
    writeConfig(join(homedir(), ".bun-scripts", "setting.json"), {
      "run-scripts": { picker: "inquirer" },
    });
    try {
      const config = loadConfig();
      expect(config["run-scripts"]?.picker).toBe("inquirer");
    } finally {
      rmSync(join(homedir(), ".bun-scripts", "setting.json"));
    }
  });

  test("local config takes priority over global when both exist", () => {
    writeConfig(join(homedir(), ".bun-scripts", "setting.json"), {
      "run-scripts": { picker: "fzf" },
    });
    writeConfig(join(tmpDir, ".bun-scripts", "setting.json"), {
      "run-scripts": { picker: "inquirer" },
    });
    try {
      const config = loadConfig();
      expect(config["run-scripts"]?.picker).toBe("inquirer");
    } finally {
      rmSync(join(homedir(), ".bun-scripts", "setting.json"));
    }
  });

  test("returns empty config when config file contains invalid JSON", () => {
    mkdirSync(join(tmpDir, ".bun-scripts"), { recursive: true });
    writeFileSync(join(tmpDir, ".bun-scripts", "setting.json"), "not json");
    const config = loadConfig();
    expect(config["run-scripts"]?.picker).toBeUndefined();
  });
});

/**
 * @test-suite  getPickerMode
 * @target      picker mode resolution from config
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] returns fzf by default when no picker is configured
 *   - [PASS] returns inquirer when picker is set to inquirer
 *   - [PASS] returns fzf when picker is explicitly set to fzf
 */
describe("getPickerMode", () => {
  test("returns fzf by default when no picker is configured", () => {
    expect(getPickerMode({})).toBe("fzf");
  });

  test("returns inquirer when picker is set to inquirer", () => {
    expect(getPickerMode({ "run-scripts": { picker: "inquirer" } })).toBe("inquirer");
  });

  test("returns fzf when picker is explicitly set to fzf", () => {
    expect(getPickerMode({ "run-scripts": { picker: "fzf" } })).toBe("fzf");
  });
});

/**
 * @test-suite  initSetting
 * @target      config file and .gitignore creation
 * @strategy    unit, uses temp filesystem, chdir to isolated dir
 * @cases
 *   - [PASS] creates local setting.json and .gitignore when not global
 *   - [PASS] local .gitignore contains * when created
 *   - [PASS] local setting.json contains default picker fzf when created
 *   - [PASS] does not overwrite existing setting.json when already exists
 */
describe("initSetting", () => {
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

  test("creates local setting.json and .gitignore when not global", () => {
    initSetting(false);
    expect(existsSync(join(tmpDir, ".bun-scripts", "setting.json"))).toBe(true);
    expect(existsSync(join(tmpDir, ".bun-scripts", ".gitignore"))).toBe(true);
  });

  test("local .gitignore contains * when created", () => {
    initSetting(false);
    const content = readFileSync(join(tmpDir, ".bun-scripts", ".gitignore"), "utf8");
    expect(content.trim()).toBe("*");
  });

  test("local setting.json contains default picker fzf when created", () => {
    initSetting(false);
    const config = JSON.parse(readFileSync(join(tmpDir, ".bun-scripts", "setting.json"), "utf8"));
    expect(config["run-scripts"]?.picker).toBe("fzf");
  });

  test("does not overwrite existing setting.json when already exists", () => {
    mkdirSync(join(tmpDir, ".bun-scripts"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".bun-scripts", "setting.json"),
      JSON.stringify({ "run-scripts": { picker: "inquirer" } }),
    );
    initSetting(false);
    const config = JSON.parse(readFileSync(join(tmpDir, ".bun-scripts", "setting.json"), "utf8"));
    expect(config["run-scripts"]?.picker).toBe("inquirer");
  });
});
