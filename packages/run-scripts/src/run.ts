import { spawnSync } from "node:child_process";
import type { PackageManager } from "./detect";
import type { ScriptEntry } from "./collect";

export function buildRunArgs(
  pm: PackageManager,
  filter: string | null,
  script: string,
  extra: string[],
): string[] {
  if (!filter) return ["run", script, ...extra];

  switch (pm) {
    case "pnpm":
    case "bun":
      return ["--filter", filter, "run", script, ...extra];
    case "yarn":
      return ["workspace", filter, script, ...extra];
    case "npm":
      return ["run", script, `--workspace=${filter}`, ...extra];
  }
}

export function execute(
  pm: PackageManager,
  scriptsMap: Map<string, ScriptEntry>,
  selected: string,
  extra: string[],
): never {
  const target = scriptsMap.get(selected);
  if (!target) process.exit(1);

  const args = buildRunArgs(pm, target.filter, target.script, extra);
  console.log(`\nRunning: ${pm} ${args.join(" ")}\n`);
  const result = spawnSync(pm, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
