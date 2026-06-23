#!/usr/bin/env -S bun --env-file /dev/null

import { existsSync, readFileSync } from "node:fs";
import { Glob } from "bun";

type PackageManager = "pnpm" | "bun" | "yarn" | "npm";

interface ScriptEntry {
  filter: string | null;
  script: string;
}

// Pure helpers — no instance state needed

function detectPackageManager(): PackageManager {
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("bun.lock") || existsSync("bun.lockb")) return "bun";
  if (existsSync("yarn.lock")) return "yarn";
  if (existsSync("package-lock.json")) return "npm";
  return "npm";
}

/** Minimal parser for pnpm-workspace.yaml — only needs the packages list */
function parsePnpmWorkspace(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of content.split("\n")) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = /^\s+-\s+['"]?([^'"]+)['"]?/.exec(line);
      if (match) {
        const value = match[1]?.trim() ?? "";
        if (value && !value.startsWith("!")) patterns.push(value);
      } else if (/^\S/.test(line) && line.trim()) {
        break; // next top-level key
      }
    }
  }

  return patterns;
}

function fuzzyMatch(str: string, query: string): boolean {
  let i = 0;
  for (const ch of str) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

class PackageScriptRunner {
  private readonly pm: PackageManager;
  private readonly query: string;
  private readonly extra: string[];
  private readonly scriptsMap: Map<string, ScriptEntry>;

  constructor() {
    this.pm = detectPackageManager();
    this.query = process.argv[2] ?? "";
    this.extra = process.argv.slice(3);
    this.scriptsMap = this.collectScripts();
  }

  run(): void {
    const list = Array.from(this.scriptsMap.keys());
    const candidates = this.query ? list.filter((k) => fuzzyMatch(k, this.query)) : list;

    let selected = "";

    if (this.query && this.scriptsMap.has(this.query)) {
      selected = this.query;
    } else if (candidates.length === 1) {
      selected = candidates[0] ?? "";
    }

    if (!selected) {
      selected = this.pick(candidates);
    }

    if (selected) {
      this.execute(selected);
    }
  }

  /** Launches fzf to let the user pick, or falls through to the package manager if no candidates. */
  private pick(candidates: string[]): string {
    if (this.query && candidates.length === 0) {
      const args = [this.query, ...this.extra];
      console.log(`\nNo matching scripts, trying: ${this.pm} ${args.join(" ")}\n`);
      const result = Bun.spawnSync([this.pm, ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(result.exitCode ?? 1);
    }

    try {
      const fzf = Bun.spawnSync(["fzf", "--query", this.query], {
        stdin: Buffer.from(candidates.join("\n")),
        stdout: "pipe",
        stderr: "inherit",
      });

      if (fzf.exitCode !== 0) {
        process.exit(fzf.exitCode);
      }

      return fzf.stdout.toString().trim();
    } catch (err) {
      console.error(
        `Error: failed to launch fzf — ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  private execute(selected: string): void {
    const target = this.scriptsMap.get(selected);
    if (!target) return;

    const args = this.buildRunArgs(target.filter, target.script);
    console.log(`\n🚀 Executing: ${this.pm} ${args.join(" ")}\n`);
    const result = Bun.spawnSync([this.pm, ...args], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(result.exitCode ?? 1);
  }

  private buildRunArgs(filter: string | null, script: string): string[] {
    if (!filter) return ["run", script, ...this.extra];

    switch (this.pm) {
      case "pnpm":
      case "bun":
        return ["--filter", filter, "run", script, ...this.extra];
      case "yarn":
        return ["workspace", filter, script, ...this.extra];
      case "npm":
        return ["run", script, `--workspace=${filter}`, ...this.extra];
    }
  }

  private collectScripts(): Map<string, ScriptEntry> {
    const hasRootPkg = existsSync("package.json");

    if (!hasRootPkg && !existsSync("pnpm-workspace.yaml")) {
      console.error("Error: not in a project root (no package.json or pnpm-workspace.yaml found)");
      process.exit(1);
    }

    const scriptsMap = new Map<string, ScriptEntry>();
    const patterns = this.readWorkspacePatterns();
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

  private scanWorkspacePackages(
    patterns: string[],
  ): Array<{ name: string; shortName: string; scripts: string[] }> {
    const packages: Array<{ name: string; shortName: string; scripts: string[] }> = [];

    for (const pattern of patterns) {
      const glob = new Glob(`${pattern}/package.json`);
      for (const file of glob.scanSync({ cwd: ".", onlyFiles: true })) {
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

  private readWorkspacePatterns(): string[] {
    if (this.pm === "pnpm" && existsSync("pnpm-workspace.yaml")) {
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
}

new PackageScriptRunner().run();
