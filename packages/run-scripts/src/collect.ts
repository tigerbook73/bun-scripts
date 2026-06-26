import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { parsePnpmWorkspace } from "./detect";
import type { PackageManager } from "./detect";

export interface ScriptEntry {
  filter: string | null;
  script: string;
}

export function collectScripts(pm: PackageManager): Map<string, ScriptEntry> {
  const hasRootPkg = existsSync("package.json");

  if (!hasRootPkg && !existsSync("pnpm-workspace.yaml")) {
    console.error("Error: not in a project root (no package.json or pnpm-workspace.yaml found)");
    process.exit(1);
  }

  const scriptsMap = new Map<string, ScriptEntry>();
  const patterns = readWorkspacePatterns(pm);
  const isMonorepo = patterns.length > 0;

  if (hasRootPkg) {
    const rootPkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    for (const script of Object.keys(rootPkg.scripts ?? {})) {
      const key = isMonorepo ? `root/${script}` : script;
      scriptsMap.set(key, { filter: null, script });
    }
  }

  const packages = scanWorkspacePackages(patterns);

  const shortNameCount = new Map<string, number>();
  for (const { shortName } of packages) {
    shortNameCount.set(shortName, (shortNameCount.get(shortName) ?? 0) + 1);
  }

  for (const { name, shortName, scripts } of packages) {
    const prefix = (shortNameCount.get(shortName) ?? 1) > 1 ? name : shortName;
    for (const script of scripts) {
      scriptsMap.set(`${prefix}/${script}`, { filter: name, script });
    }
  }

  return scriptsMap;
}

function readWorkspacePatterns(pm: PackageManager): string[] {
  if (pm === "pnpm" && existsSync("pnpm-workspace.yaml")) {
    return parsePnpmWorkspace(readFileSync("pnpm-workspace.yaml", "utf8"));
  }

  if (existsSync("package.json")) {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      workspaces?: string[] | { packages?: string[] };
    };
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) return ws;
    if (ws && Array.isArray(ws.packages)) return ws.packages;
  }

  return [];
}

function scanWorkspacePackages(
  patterns: string[],
): Array<{ name: string; shortName: string; scripts: string[] }> {
  const packages: Array<{ name: string; shortName: string; scripts: string[] }> = [];

  for (const pattern of patterns) {
    for (const file of globSync(`${pattern}/package.json`, { cwd: "." })) {
      try {
        const pkg = JSON.parse(readFileSync(file, "utf8")) as {
          name?: string;
          scripts?: Record<string, string>;
        };
        if (!pkg.scripts || !pkg.name) continue;
        const shortName = pkg.name.split("/").pop() ?? pkg.name;
        packages.push({ name: pkg.name, shortName, scripts: Object.keys(pkg.scripts) });
      } catch {
        // ignore malformed json
      }
    }
  }

  return packages;
}
