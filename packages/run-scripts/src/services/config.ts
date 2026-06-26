import { loadToolConfig, initToolSection } from "@tigerbook/settings";

export type PickerMode = "fzf" | "node";

export interface RunScriptsConfig {
  picker?: PickerMode;
}

const TOOL = "run-scripts";

const INIT_TOML = `\
[run-scripts]
# Preferred picker: "fzf" (default, falls back to built-in if not on PATH) | "node" (always built-in)
picker = "fzf"
`;

export interface IConfigService {
  load(): RunScriptsConfig;
  getPickerMode(config: RunScriptsConfig): PickerMode;
  init(isGlobal: boolean): void;
}

export class ConfigService implements IConfigService {
  load(): RunScriptsConfig {
    return loadToolConfig<RunScriptsConfig>(TOOL);
  }

  getPickerMode(config: RunScriptsConfig): PickerMode {
    return config.picker ?? "fzf";
  }

  init(isGlobal: boolean): void {
    initToolSection(isGlobal, TOOL, INIT_TOML);
  }
}
