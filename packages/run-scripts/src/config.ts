import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type PickerMode = "fzf" | "inquirer";

export interface RunScriptsConfig {
  picker?: PickerMode;
}

export interface Config {
  "run-scripts"?: RunScriptsConfig;
}

const GLOBAL_CONFIG_PATH = join(homedir(), ".bun-scripts", "setting.json");
const LOCAL_CONFIG_PATH = join(".bun-scripts", "setting.json");

function readConfigFile(path: string): Config {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Config;
  } catch {
    return {};
  }
}

/** Loads global then local config, local fields take priority. */
export function loadConfig(): Config {
  const global = readConfigFile(GLOBAL_CONFIG_PATH);
  const local = readConfigFile(LOCAL_CONFIG_PATH);
  return {
    ...global,
    ...local,
    "run-scripts": {
      ...global["run-scripts"],
      ...local["run-scripts"],
    },
  };
}

export function getPickerMode(config: Config): PickerMode {
  return config["run-scripts"]?.picker ?? "fzf";
}

const DEFAULT_CONFIG: Config = {
  "run-scripts": {
    picker: "fzf",
  },
};

/**
 * Creates a config file at the global or local path.
 * Local also writes a .gitignore to prevent the directory from being committed.
 */
export function initSetting(isGlobal: boolean): void {
  const dir = isGlobal ? join(homedir(), ".bun-scripts") : ".bun-scripts";
  const configPath = join(dir, "setting.json");

  if (existsSync(configPath)) {
    console.log(`Config already exists: ${configPath}`);
    return;
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  console.log(`Created: ${configPath}`);

  if (!isGlobal) {
    const gitignorePath = join(dir, ".gitignore");
    writeFileSync(gitignorePath, "*\n");
    console.log(`Created: ${gitignorePath}`);
  }
}
