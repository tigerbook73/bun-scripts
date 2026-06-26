import { spawnSync as _spawnSync } from "node:child_process";
import type { PackageManager, ScriptEntry } from "./workspace";
import { buildRunArgs } from "../lib/run-args";
import { CliExitError } from "../errors";

interface RunnerDeps {
  spawnSync: typeof _spawnSync;
  log: (msg: string) => void;
}

export interface IRunnerService {
  execute(
    pm: PackageManager,
    scriptsMap: Map<string, ScriptEntry>,
    selected: string,
    extra: string[],
  ): number;
  spawnPackage(pm: PackageManager, args: string[]): number;
}

export class RunnerService implements IRunnerService {
  constructor(
    private deps: RunnerDeps = {
      spawnSync: _spawnSync,
      log: console.log,
    },
  ) {}

  execute(
    pm: PackageManager,
    scriptsMap: Map<string, ScriptEntry>,
    selected: string,
    extra: string[],
  ): number {
    const target = scriptsMap.get(selected);
    if (!target) throw new CliExitError(`Unknown script: ${selected}`, 1);

    const args = buildRunArgs(pm, target.filter, target.script, extra);
    this.deps.log(`\nRunning: ${pm} ${args.join(" ")}\n`);
    const result = this.deps.spawnSync(pm, args, { stdio: "inherit" });
    return result.status ?? 1;
  }

  spawnPackage(pm: PackageManager, args: string[]): number {
    const result = this.deps.spawnSync(pm, args, { stdio: "inherit" });
    return result.status ?? 1;
  }
}
