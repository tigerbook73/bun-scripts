/**
 * @test-file   run-args
 * @description Unit tests for buildRunArgs: package manager command argument construction
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect } from "bun:test";
import { buildRunArgs } from "./lib/run-args";

/**
 * @test-suite  buildRunArgs
 * @target      package manager command argument construction
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] root script: run <script> when filter is null
 *   - [PASS] root script passes extra args when extra args are provided
 *   - [PASS] pnpm workspace: --filter <name> run <script> for pnpm
 *   - [PASS] bun workspace: same as pnpm for bun
 *   - [PASS] yarn workspace: workspace <name> <script> for yarn
 *   - [PASS] npm workspace: run <script> --workspace=<name> for npm
 */
describe("buildRunArgs", () => {
  test("root script: run <script> when filter is null", () => {
    expect(buildRunArgs("pnpm", null, "build", [])).toEqual(["run", "build"]);
  });

  test("root script passes extra args when extra args are provided", () => {
    expect(buildRunArgs("pnpm", null, "build", ["--", "--watch"])).toEqual([
      "run",
      "build",
      "--",
      "--watch",
    ]);
  });

  test("pnpm workspace: --filter <name> run <script> for pnpm", () => {
    expect(buildRunArgs("pnpm", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("bun workspace: same as pnpm for bun", () => {
    expect(buildRunArgs("bun", "@scope/foo", "build", [])).toEqual([
      "--filter",
      "@scope/foo",
      "run",
      "build",
    ]);
  });

  test("yarn workspace: workspace <name> <script> for yarn", () => {
    expect(buildRunArgs("yarn", "@scope/foo", "build", [])).toEqual([
      "workspace",
      "@scope/foo",
      "build",
    ]);
  });

  test("npm workspace: run <script> --workspace=<name> for npm", () => {
    expect(buildRunArgs("npm", "@scope/foo", "build", [])).toEqual([
      "run",
      "build",
      "--workspace=@scope/foo",
    ]);
  });
});
