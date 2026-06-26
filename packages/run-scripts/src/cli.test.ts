/**
 * @test-file   cli
 * @description Unit tests for runCli: flag forwarding, unmatched query forwarding, fuzzy auto-select, picker cancellation
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
 *   - [PASS] forwards first-arg flags directly to the package manager
 *   - [PASS] forwards unmatched queries to the package manager
 *   - [PASS] executes the only fuzzy match without opening the picker
 *   - [PASS] returns zero when the picker is cancelled
 */
describe("runCli", () => {
  test("forwards first-arg flags directly to the package manager", async () => {
    const spawned: string[][] = [];
    const deps = createDeps({
      runner: {
        execute: () => 0,
        spawnPackage: (pm, args) => {
          spawned.push([pm, ...args]);
          return 7;
        },
      },
    });

    const code = await runCli(["--filter", "api", "dev"], deps);

    expect(code).toBe(7);
    expect(spawned).toEqual([["pnpm", "--filter", "api", "dev"]]);
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
