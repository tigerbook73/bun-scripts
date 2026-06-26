import {
  existsSync as _existsSync,
  readFileSync as _readFileSync,
  globSync as _globSync,
} from "node:fs";
import { parsePnpmWorkspace } from "../lib/fuzzy";
import { CliExitError } from "../errors";

export type PackageManager = "pnpm" | "bun" | "yarn" | "npm";

export interface ScriptEntry {
  filter: string | null;
  script: string;
}

interface WorkspaceDeps {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: "utf8") => string;
  globSync: (pattern: string, options: { cwd: string }) => string[];
}

export interface IWorkspaceService {
  detectPm(): PackageManager;
  collectScripts(): Map<string, ScriptEntry>;
}

export class WorkspaceService implements IWorkspaceService {
  constructor(
    private deps: WorkspaceDeps = {
      existsSync: _existsSync,
      readFileSync: (p, enc) => _readFileSync(p, enc),
      globSync: (p, opts) => _globSync(p, opts as Parameters<typeof _globSync>[1]) as string[],
    },
  ) {}

  detectPm(): PackageManager {
    const { existsSync } = this.deps;
    if (existsSync("pnpm-lock.yaml")) return "pnpm";
    if (existsSync("bun.lock") || existsSync("bun.lockb")) return "bun";
    if (existsSync("yarn.lock")) return "yarn";
    if (existsSync("package-lock.json")) return "npm";
    return "npm";
  }

  collectScripts(): Map<string, ScriptEntry> {
    const { existsSync, readFileSync } = this.deps;
    const pm = this.detectPm();

    const hasRootPkg = existsSync("package.json");

    if (!hasRootPkg && !existsSync("pnpm-workspace.yaml")) {
      throw new CliExitError(
        "Error: not in a project root (no package.json or pnpm-workspace.yaml found)",
        1,
      );
    }

    const scriptsMap = new Map<string, ScriptEntry>();
    const patterns = this.readWorkspacePatterns(pm);
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

    const packages = this.scanWorkspacePackages(patterns);

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

  private readWorkspacePatterns(pm: PackageManager): string[] {
    const { existsSync, readFileSync } = this.deps;

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

  private scanWorkspacePackages(
    patterns: string[],
  ): Array<{ name: string; shortName: string; scripts: string[] }> {
    const { readFileSync, globSync } = this.deps;
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
}
