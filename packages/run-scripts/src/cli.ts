import { fuzzyMatch } from "./lib/fuzzy";
import { buildRunArgs } from "./lib/run-args";
import type { PackageManager } from "./services/workspace";
import { WorkspaceService, type IWorkspaceService } from "./services/workspace";
import { ConfigService, type IConfigService } from "./services/config";
import { PickerService, type IPickerService } from "./services/picker";
import { RunnerService, type IRunnerService } from "./services/runner";
import { CliExitError } from "./errors";

export interface CliDeps {
  workspace: IWorkspaceService;
  config: IConfigService;
  picker: IPickerService;
  runner: IRunnerService;
  io: { log: (msg: string) => void; error: (msg: string) => void };
}

const defaultDeps: CliDeps = {
  workspace: new WorkspaceService(),
  config: new ConfigService(),
  picker: new PickerService(),
  runner: new RunnerService(),
  io: { log: console.log, error: console.error },
};

export function printHelp(log: (message: string) => void = console.log): void {
  log(`\
Usage: r [query] [-- ...args]

Fuzzy script picker for npm/pnpm/yarn/bun workspaces.

Examples:
  r                  Open picker with all available scripts
  r build            Run the script matching "build" (direct if unique)
  r build -- --watch Pass extra args to the matched script
  r tsc              If no script matches, forwards to the package manager
  r --filter api dev Forward flags directly to the package manager

Script naming in monorepos:
  api/build          Script "build" in workspace package "api"
  root/lint          Script "lint" at the repo root

Options:
  -h, --help         Show this help message
  --config [init]    Init config: create ~/.bun-scripts/setting.toml or .bun-scripts/setting.toml

Picker:
  Uses fzf if available, otherwise falls back to built-in node picker
  Configure via: r --config init [--global], then edit setting.toml
`);
}

function handleConfig(args: string[], deps: CliDeps): number {
  const isGlobal = args.includes("--global");
  const sub = args.slice(1).find((a) => !a.startsWith("-"));

  if (!sub || sub === "init") {
    deps.config.init(isGlobal);
    return 0;
  }

  deps.io.error(`Unknown config subcommand: ${sub}\nUsage: r --config [init] [--global]`);
  return 1;
}

function forwardToPackageManager(
  pm: PackageManager,
  args: string[],
  deps: CliDeps,
  messagePrefix = "Running",
): number {
  deps.io.log(`\n${messagePrefix}: ${pm} ${args.join(" ")}\n`);
  return deps.runner.spawnPackage(pm, args);
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  deps: CliDeps = defaultDeps,
): Promise<number> {
  try {
    if (argv[0] === "--help" || argv[0] === "-h") {
      printHelp(deps.io.log);
      return 0;
    }

    if (argv[0] === "--config") {
      return handleConfig(argv, deps);
    }

    const config = deps.config.load();
    const pickerMode = deps.config.getPickerMode(config);
    const pm = deps.workspace.detectPm();
    const query = argv[0] ?? "";
    const extra = argv.slice(1);

    if (query.startsWith("-")) {
      return forwardToPackageManager(pm, [query, ...extra], deps);
    }

    const scriptsMap = deps.workspace.collectScripts();
    const list = Array.from(scriptsMap.keys());
    const candidates = query ? list.filter((k) => fuzzyMatch(k, query)) : list;

    let selected = "";

    if (query && scriptsMap.has(query)) {
      selected = query;
    } else if (candidates.length === 1) {
      selected = candidates[0] ?? "";
    }

    if (!selected) {
      if (query && candidates.length === 0) {
        return forwardToPackageManager(pm, [query, ...extra], deps, "No matching scripts, trying");
      }
      const pickerCandidates = Array.from(scriptsMap, ([key, entry]) => {
        const args = buildRunArgs(pm, entry.filter, entry.script, []);
        return { name: key, description: `Run: ${pm} ${args.join(" ")}` };
      });
      selected = (await deps.picker.pick(pickerCandidates, query, pickerMode)) ?? "";
    }

    if (!selected) return 0;
    return deps.runner.execute(pm, scriptsMap, selected, extra);
  } catch (err) {
    if (err instanceof CliExitError) {
      if (!err.silent && err.message) deps.io.error(err.message);
      return err.exitCode;
    }
    deps.io.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
