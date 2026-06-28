/**
 * @test-file   cli
 * @description Unit tests for runCli: command printing, unmatched query forwarding, fuzzy auto-select, picker cancellation
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, expect, test } from "bun:test";
import { runCli, type CliDeps } from "./cli";
import type { IWorkspaceService } from "./services/workspace";
import type { IConfigService } from "./services/config";
import type { IPickerService } from "./services/picker";
import type { IRunnerService } from "./services/runner";
import type { PickerMode } from "./services/config";
import type { ScriptEntry, PackageManager } from "./services/workspace";

const defaultWorkspace: IWorkspaceService = {
  detectPm: (): PackageManager => "pnpm",
  collectScripts: () => new Map<string, ScriptEntry>(),
};

const defaultConfig: IConfigService = {
  load: () => ({}),
  getPickerMode: (): PickerMode => "node",
  init: () => {},
};

const defaultPicker: IPickerService = {
  pick: async () => undefined,
};

const defaultRunner: IRunnerService = {
  execute: () => 0,
  spawnPackage: () => 0,
};

function createDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    workspace: defaultWorkspace,
    config: defaultConfig,
    picker: defaultPicker,
    runner: defaultRunner,
    io: { log: () => {}, error: () => {} },
    ...overrides,
  };
}

/**
 * @test-suite  runCli
 * @target      CLI entry-point routing and exit-code handling
 * @strategy    unit, all services mocked via CliDeps
 * @cases
 *   - [PASS] prints the resolved script command without executing it
 *   - [PASS] treats the first unknown option after r options as the query
 *   - [PASS] treats options after the query as script arguments
 *   - [PASS] passes extra args without requiring -- separator
 *   - [PASS] initializes global config with prefix options
 *   - [PASS] rejects --global without --init-config
 *   - [PASS] shows help only when help is the only argument
 *   - [PASS] prints unmatched queries as package manager commands
 *   - [PASS] keeps --print-command after -- as a script argument
 *   - [PASS] matches first-arg flags as script queries instead of forwarding directly
 *   - [PASS] forwards unmatched queries to the package manager
 *   - [PASS] executes the only fuzzy match without opening the picker
 *   - [PASS] returns zero when the picker is cancelled
 */
describe("runCli", () => {
  test("prints the resolved script command without executing it", async () => {
    const logs: string[] = [];
    const executed: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["api/build", { filter: "@scope/api", script: "build" }]]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 7;
        },
        spawnPackage: () => 7,
      },
      io: { log: (msg) => logs.push(msg), error: () => {} },
    });

    const code = await runCli(["--print-command", "api/build", "--", "--watch", "two words"], deps);

    expect(code).toBe(0);
    expect(logs).toEqual(["pnpm --filter @scope/api run build -- --watch 'two words'"]);
    expect(executed).toEqual([]);
  });

  test("treats the first unknown option after r options as the query", async () => {
    const logs: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map<string, ScriptEntry>(),
      },
      io: { log: (msg) => logs.push(msg), error: () => {} },
    });

    const code = await runCli(["-p", "--x/xxxx", "-v/vvv"], deps);

    expect(code).toBe(0);
    expect(logs).toEqual(["pnpm --x/xxxx -v/vvv"]);
  });

  test("treats options after the query as script arguments", async () => {
    const executed: string[] = [];
    const logs: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 0;
        },
        spawnPackage: () => 7,
      },
      io: { log: (msg) => logs.push(msg), error: () => {} },
    });

    const code = await runCli(["build", "-p"], deps);

    expect(code).toBe(0);
    expect(executed).toEqual(["build", "-p"]);
    expect(logs).toEqual([]);
  });

  test("passes extra args without requiring -- separator", async () => {
    const executed: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 0;
        },
        spawnPackage: () => 7,
      },
    });

    const code = await runCli(["build", "--watch"], deps);

    expect(code).toBe(0);
    expect(executed).toEqual(["build", "--watch"]);
  });

  test("initializes global config with prefix options", async () => {
    const initCalls: boolean[] = [];
    const deps = createDeps({
      config: {
        load: () => ({}),
        getPickerMode: (): PickerMode => "node",
        init: (isGlobal) => initCalls.push(isGlobal),
      },
    });

    const code = await runCli(["--init-config", "--global"], deps);

    expect(code).toBe(0);
    expect(initCalls).toEqual([true]);
  });

  test("rejects --global without --init-config", async () => {
    const errors: string[] = [];
    const deps = createDeps({
      io: { log: () => {}, error: (msg) => errors.push(msg) },
    });

    const code = await runCli(["--global", "build"], deps);

    expect(code).toBe(1);
    expect(errors).toEqual(["Usage: r --init-config [--global]"]);
  });

  test("shows help only when help is the only argument", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const deps = createDeps({
      io: { log: (msg) => logs.push(msg), error: (msg) => errors.push(msg) },
    });

    expect(await runCli(["-h"], deps)).toBe(0);
    expect(logs[0]).toContain("Usage: r [options...] [query] [[--] ...args]");
    expect(await runCli(["-h", "build"], deps)).toBe(1);
    expect(errors).toEqual(["Usage: r --help"]);
  });

  test("prints unmatched queries as package manager commands", async () => {
    const logs: string[] = [];
    const spawned: string[][] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      runner: {
        execute: () => 7,
        spawnPackage: (pm, args) => {
          spawned.push([pm, ...args]);
          return 7;
        },
      },
      io: { log: (msg) => logs.push(msg), error: () => {} },
    });

    const code = await runCli(["--print-command", "tsc", "--noEmit"], deps);

    expect(code).toBe(0);
    expect(logs).toEqual(["pnpm tsc --noEmit"]);
    expect(spawned).toEqual([]);
  });

  test("keeps --print-command after -- as a script argument", async () => {
    const executed: string[] = [];
    const logs: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 0;
        },
        spawnPackage: () => 7,
      },
      io: { log: (msg) => logs.push(msg), error: () => {} },
    });

    const code = await runCli(["build", "--", "--print-command"], deps);

    expect(code).toBe(0);
    expect(executed).toEqual(["build", "--", "--print-command"]);
    expect(logs).toEqual([]);
  });

  test("matches first-arg flags as script queries instead of forwarding directly", async () => {
    const executed: string[] = [];
    const spawned: string[][] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["--build", { filter: null, script: "--build" }]]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 0;
        },
        spawnPackage: (pm, args) => {
          spawned.push([pm, ...args]);
          return 7;
        },
      },
    });

    const code = await runCli(["--build"], deps);

    expect(code).toBe(0);
    expect(executed).toEqual(["--build"]);
    expect(spawned).toEqual([]);
  });

  test("forwards unmatched queries to the package manager", async () => {
    const spawned: string[][] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      runner: {
        execute: () => 0,
        spawnPackage: (pm, args) => {
          spawned.push([pm, ...args]);
          return 0;
        },
      },
    });

    const code = await runCli(["tsc", "--noEmit"], deps);

    expect(code).toBe(0);
    expect(spawned).toEqual([["pnpm", "tsc", "--noEmit"]]);
  });

  test("executes the only fuzzy match without opening the picker", async () => {
    const executed: string[] = [];
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () =>
          new Map([
            ["api/build", { filter: "@scope/api", script: "build" }],
            ["web/dev", { filter: "@scope/web", script: "dev" }],
          ]),
      },
      runner: {
        execute: (_pm, _scriptsMap, selected, extra) => {
          executed.push(selected, ...extra);
          return 0;
        },
        spawnPackage: () => 0,
      },
    });

    const code = await runCli(["ab", "--", "--watch"], deps);

    expect(code).toBe(0);
    expect(executed).toEqual(["api/build", "--", "--watch"]);
  });

  test("returns zero when the picker is cancelled", async () => {
    const deps = createDeps({
      workspace: {
        detectPm: () => "pnpm",
        collectScripts: () => new Map([["build", { filter: null, script: "build" }]]),
      },
      picker: { pick: async () => undefined },
    });

    expect(await runCli([], deps)).toBe(0);
  });
});
