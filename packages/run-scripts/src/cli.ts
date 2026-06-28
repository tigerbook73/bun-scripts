import { fuzzyMatch } from "./lib/fuzzy";
import { buildRunArgs } from "./lib/run-args";
import type { PackageManager, ScriptEntry } from "./services/workspace";
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
Usage: r [options...] [query] [[--] ...args]

Fuzzy script picker for npm/pnpm/yarn/bun workspaces.

Examples:
  r                  Open picker with all available scripts
  r build            Run the script matching "build" (direct if unique)
  r build -- --watch Pass extra args through to the matched script
  r -p build
                     Print the resolved command instead of running it
  r tsc              If no script matches, forwards to the package manager

Script naming in monorepos:
  api/build          Script "build" in workspace package "api"
  root/lint          Script "lint" at the repo root

Options:
  -h, --help         Show this help message
  -p, --print-command
                     Print the resolved command instead of running it
  --init-config      Create .bun-scripts/setting.toml
  --global           With --init-config, create ~/.bun-scripts/setting.toml

Picker:
  Uses fzf if available, otherwise falls back to built-in node picker
  Configure via: r --init-config [--global], then edit setting.toml
`);
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

function parseCliArgs(argv: string[]): {
  args: string[];
  global: boolean;
  help: boolean;
  initConfig: boolean;
  printCommand: boolean;
} {
  let global = false;
  let help = false;
  let initConfig = false;
  let printCommand = false;
  let queryStart = 0;

  for (; queryStart < argv.length; queryStart += 1) {
    const arg = argv[queryStart];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--print-command" || arg === "-p") {
      printCommand = true;
      continue;
    }
    if (arg === "--init-config") {
      initConfig = true;
      continue;
    }
    if (arg === "--global") {
      global = true;
      continue;
    }

    break;
  }

  return { args: argv.slice(queryStart), global, help, initConfig, printCommand };
}

function quoteShellArg(arg: string): string {
  if (/^[A-Za-z0-9_/:=@%+.,-]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", "'\\''")}'`;
}

function formatCommand(pm: PackageManager, args: string[]): string {
  return [pm, ...args].map(quoteShellArg).join(" ");
}

function printScriptCommand(
  pm: PackageManager,
  scriptsMap: Map<string, ScriptEntry>,
  selected: string,
  extra: string[],
  deps: CliDeps,
): number {
  const target = scriptsMap.get(selected);
  if (!target) throw new CliExitError(`Unknown script: ${selected}`, 1);

  deps.io.log(formatCommand(pm, buildRunArgs(pm, target.filter, target.script, extra)));
  return 0;
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  deps: CliDeps = defaultDeps,
): Promise<number> {
  try {
    const rawArgv = argv;
    const parsed = parseCliArgs(argv);
    argv = parsed.args;

    if (parsed.help) {
      if (rawArgv.length !== 1) {
        deps.io.error("Usage: r --help");
        return 1;
      }
      printHelp(deps.io.log);
      return 0;
    }

    if (parsed.initConfig) {
      if (parsed.printCommand || parsed.args.length > 0) {
        deps.io.error("Usage: r --init-config [--global]");
        return 1;
      }
      deps.config.init(parsed.global);
      return 0;
    }

    if (parsed.global) {
      deps.io.error("Usage: r --init-config [--global]");
      return 1;
    }

    const config = deps.config.load();
    const pickerMode = deps.config.getPickerMode(config);
    const pm = deps.workspace.detectPm();
    const query = argv[0] ?? "";
    const extra = argv.slice(1);

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
        if (parsed.printCommand) {
          deps.io.log(formatCommand(pm, [query, ...extra]));
          return 0;
        }
        return forwardToPackageManager(pm, [query, ...extra], deps, "No matching scripts, trying");
      }
      const pickerCandidates = Array.from(scriptsMap, ([key, entry]) => {
        const args = buildRunArgs(pm, entry.filter, entry.script, []);
        return { name: key, description: `Run: ${pm} ${args.join(" ")}` };
      });
      selected = (await deps.picker.pick(pickerCandidates, query, pickerMode)) ?? "";
    }

    if (!selected) return 0;
    if (parsed.printCommand) return printScriptCommand(pm, scriptsMap, selected, extra, deps);
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
