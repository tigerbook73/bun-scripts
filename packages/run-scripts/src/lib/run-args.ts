import type { PackageManager } from "../services/workspace";

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
