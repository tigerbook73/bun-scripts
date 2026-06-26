/**
 * @test-file   fuzzy
 * @description Unit tests for fuzzyMatch and parsePnpmWorkspace pure functions
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */

import { describe, test, expect } from "bun:test";
import { fuzzyMatch, parsePnpmWorkspace } from "./lib/fuzzy";

/**
 * @test-suite  fuzzyMatch
 * @target      fuzzy character-sequence matching
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] matches characters in order when query is a prefix substring
 *   - [PASS] matches exact string when query equals the full string
 *   - [PASS] matches non-consecutive characters when they appear in order
 *   - [FAIL] returns false when characters are out of order
 *   - [FAIL] returns false when query has no match in string
 *   - [PASS] empty query always matches non-empty string
 *   - [FAIL] returns false for empty string with non-empty query
 */
describe("fuzzyMatch", () => {
  test("matches characters in order when query is a prefix substring", () => {
    expect(fuzzyMatch("install:tools", "instal")).toBe(true);
  });

  test("matches exact string when query equals the full string", () => {
    expect(fuzzyMatch("build", "build")).toBe(true);
  });

  test("matches non-consecutive characters when they appear in order", () => {
    expect(fuzzyMatch("lint:fix", "lf")).toBe(true);
  });

  test("returns false when characters are out of order", () => {
    expect(fuzzyMatch("abc", "cab")).toBe(false);
  });

  test("returns false when query has no match in string", () => {
    expect(fuzzyMatch("lint", "xyz")).toBe(false);
  });

  test("empty query always matches non-empty string", () => {
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  test("returns false for empty string with non-empty query", () => {
    expect(fuzzyMatch("", "a")).toBe(false);
  });
});

/**
 * @test-suite  parsePnpmWorkspace
 * @target      pnpm-workspace.yaml package list parsing
 * @strategy    unit, no mocks
 * @cases
 *   - [PASS] parses single-quoted entries when yaml uses single quotes
 *   - [PASS] parses double-quoted entries when yaml uses double quotes
 *   - [PASS] parses unquoted entries when yaml has no quotes
 *   - [PASS] parses multiple entries when packages list has multiple items
 *   - [PASS] skips negation patterns when entry starts with !
 *   - [PASS] stops at next top-level key when packages block ends
 *   - [PASS] returns empty array when no packages key is present
 */
describe("parsePnpmWorkspace", () => {
  test("parses single-quoted entries when yaml uses single quotes", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n")).toEqual(["packages/*"]);
  });

  test("parses double-quoted entries when yaml uses double quotes", () => {
    expect(parsePnpmWorkspace('packages:\n  - "apps/*"\n')).toEqual(["apps/*"]);
  });

  test("parses unquoted entries when yaml has no quotes", () => {
    expect(parsePnpmWorkspace("packages:\n  - packages/*\n")).toEqual(["packages/*"]);
  });

  test("parses multiple entries when packages list has multiple items", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - 'apps/*'\n")).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  test("skips negation patterns when entry starts with !", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\n  - '!**/test/**'\n")).toEqual([
      "packages/*",
    ]);
  });

  test("stops at next top-level key when packages block ends", () => {
    expect(parsePnpmWorkspace("packages:\n  - 'packages/*'\ncatalog:\n  react: ^18\n")).toEqual([
      "packages/*",
    ]);
  });

  test("returns empty array when no packages key is present", () => {
    expect(parsePnpmWorkspace("catalog:\n  react: ^18\n")).toEqual([]);
  });
});
