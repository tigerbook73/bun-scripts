import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { parse } from "smol-toml";

const SETTINGS_DIR = ".bun-scripts";
const SETTINGS_FILE = "setting.toml";

export const GLOBAL_CONFIG_PATH = join(homedir(), SETTINGS_DIR, SETTINGS_FILE);

/** Resolved at call time so CWD changes (e.g. process.chdir in tests) are respected. */
export function getLocalConfigPath(): string {
  return join(process.cwd(), SETTINGS_DIR, SETTINGS_FILE);
}

function readTomlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Load a tool's config section from merged global + local setting.toml. Local takes priority. */
export function loadToolConfig<T extends object>(tool: string): Partial<T> {
  const merged = deepMerge(readTomlFile(GLOBAL_CONFIG_PATH), readTomlFile(getLocalConfigPath()));
  return (merged[tool] ?? {}) as Partial<T>;
}

/**
 * Initialize a tool's section in setting.toml.
 *
 * - Creates the file with `tomlContent` if it does not exist.
 * - Appends `tomlContent` if the file exists but the tool's section is absent.
 * - No-ops if the section already exists.
 * - Local init also writes a .gitignore to prevent accidental commits.
 *
 * @param tomlContent TOML text to write/append — include the section header and any comments.
 */
function hasSection(path: string, tool: string): boolean {
  if (!existsSync(path)) return false;
  const content = readFileSync(path, "utf8");
  try {
    return tool in parse(content);
  } catch {
    // File has invalid TOML (e.g. mid-edit); treat as existing to avoid corrupting it
    return content.includes(`[${tool}]`) || content.includes(`["${tool}"]`);
  }
}

export function initToolSection(isGlobal: boolean, tool: string, tomlContent: string): void {
  const configPath = isGlobal ? GLOBAL_CONFIG_PATH : getLocalConfigPath();

  if (hasSection(configPath, tool)) {
    console.log(`Config already exists: ${configPath} [${tool}]`);
    return;
  }

  mkdirSync(dirname(configPath), { recursive: true });

  if (!existsSync(configPath)) {
    writeFileSync(configPath, tomlContent.trimStart());
    console.log(`Created: ${configPath}`);
  } else {
    appendFileSync(configPath, "\n" + tomlContent.trimStart());
    console.log(`Updated: ${configPath} (appended [${tool}])`);
  }

  if (!isGlobal) {
    const gitignorePath = join(dirname(configPath), ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, "*\n");
      console.log(`Created: ${gitignorePath}`);
    }
  }
}
