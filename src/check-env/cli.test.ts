/**
 * @file cli.test.ts
 * @description Integration tests for the check-env CLI — spawns the real script in a temp dir
 *   and asserts on stdout, stderr, and exit codes.
 */

import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const CLI = join(import.meta.dir, "index.ts");

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(args: string[], files: Record<string, string> = {}): Promise<CliResult> {
  const dir = mkdtempSync(join(tmpdir(), "check-env-cli-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      const full = join(dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    const proc = Bun.spawn(["bun", CLI, "--no-color", ...args], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

// Shared fixtures
const EXAMPLE = [
  "# Database",
  "DB_HOST=",
  "DB_PORT=5432",
  "",
  "# App",
  "PORT=<number>",
  "SECRET_KEY=<secret>",
  "# FEATURE_FLAG=false",
].join("\n");

const ENV_FULL = "DB_HOST=localhost\nDB_PORT=5432\nPORT=8080\nSECRET_KEY=sk-123456\n";
const ENV_MISSING_HOST = "DB_PORT=5432\nPORT=8080\nSECRET_KEY=sk-abc\n";
const ENV_BAD_TYPE = "DB_HOST=localhost\nDB_PORT=5432\nPORT=not-a-number\nSECRET_KEY=sk-abc\n";

// ─── check — standard (default) ───────────────────────────────────────────────

describe("check — standard (default)", () => {
  test("exit 0 when all required vars are configured", async () => {
    const { exitCode } = await run([], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(exitCode).toBe(0);
  });

  test("shows status symbol and key for each var", async () => {
    const { stdout } = await run([], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("✓");
    expect(stdout).toContain("DB_HOST");
    expect(stdout).toContain("PORT");
  });

  test("does not print section titles", async () => {
    const { stdout } = await run([], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    const lines = stdout.split("\n");
    expect(lines).not.toContain("# Database");
    expect(lines).not.toContain("# App");
  });

  test("does not print blank lines between sections", async () => {
    const { stdout } = await run([], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    const lines = stdout.trimEnd().split("\n");
    expect(lines).not.toContain("");
  });

  test("exit 1 when required var is missing", async () => {
    const { exitCode } = await run([], {
      ".env.example": EXAMPLE,
      ".env": ENV_MISSING_HOST,
    });
    expect(exitCode).toBe(1);
  });

  test("exit 1 on type error", async () => {
    const { exitCode } = await run([], {
      ".env.example": EXAMPLE,
      ".env": ENV_BAD_TYPE,
    });
    expect(exitCode).toBe(1);
  });
});

// ─── check --verbose / -v ─────────────────────────────────────────────────────

describe("check --verbose / -v", () => {
  test("prints section titles", async () => {
    const { stdout } = await run(["--verbose"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("# Database");
    expect(stdout).toContain("# App");
  });

  test("-v is an alias for --verbose", async () => {
    const { stdout } = await run(["-v"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("# Database");
  });

  test("prints blank line before second section", async () => {
    const { stdout } = await run(["-v"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("\n\n");
  });
});

// ─── check --quiet / -q ───────────────────────────────────────────────────────

describe("check --quiet / -q", () => {
  test("outputs status symbol and key only", async () => {
    const { stdout } = await run(["-q"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("✓");
    expect(stdout).toContain("DB_HOST");
    expect(stdout).not.toContain("localhost");
  });

  test("-q is an alias for --quiet", async () => {
    const { stdout: a } = await run(["-q"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    const { stdout: b } = await run(["--quiet"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(a).toBe(b);
  });

  test("does not print blank lines between sections", async () => {
    const { stdout } = await run(["--quiet"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    const lines = stdout.trimEnd().split("\n");
    expect(lines).not.toContain("");
  });
});

// ─── check --silent / -s ──────────────────────────────────────────────────────

describe("check --silent / -s", () => {
  test("produces no output and exits 0 on success", async () => {
    const { stdout, exitCode } = await run(["-s"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("lists missing vars and exits 1 on failure", async () => {
    const { stdout, exitCode } = await run(["--silent"], {
      ".env.example": EXAMPLE,
      ".env": ENV_MISSING_HOST,
    });
    expect(stdout).toContain("DB_HOST");
    expect(exitCode).toBe(1);
  });
});

// ─── check --mismatch / -m ────────────────────────────────────────────────────

describe("check --mismatch / -m", () => {
  test("produces no output and exits 0 on success", async () => {
    const { stdout, exitCode } = await run(["-m"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  test("lists only ✗ for missing vars and exits 1", async () => {
    const { stdout, exitCode } = await run(["--mismatch"], {
      ".env.example": EXAMPLE,
      ".env": ENV_MISSING_HOST,
    });
    expect(stdout).toContain("✗");
    expect(stdout).toContain("DB_HOST");
    expect(exitCode).toBe(1);
  });
});

// ─── get subcommand ───────────────────────────────────────────────────────────

describe("get subcommand", () => {
  test("outputs all configured vars as KEY=VALUE", async () => {
    const { stdout, exitCode } = await run(["get"], { ".env.example": EXAMPLE, ".env": ENV_FULL });
    expect(stdout).toContain("DB_HOST=localhost");
    expect(stdout).toContain("DB_PORT=5432");
    expect(exitCode).toBe(0);
  });

  test("filters to specified keys", async () => {
    const { stdout } = await run(["get", "DB_HOST"], {
      ".env.example": EXAMPLE,
      ".env": ENV_FULL,
    });
    expect(stdout).toContain("DB_HOST=localhost");
    expect(stdout).not.toContain("DB_PORT");
  });

  test("--json outputs a JSON object", async () => {
    const { stdout } = await run(["get", "--json"], {
      ".env.example": EXAMPLE,
      ".env": ENV_FULL,
    });
    const parsed = JSON.parse(stdout) as Record<string, string>;
    expect(parsed).toMatchObject({ DB_HOST: "localhost", DB_PORT: "5432" });
  });
});

// ─── dump subcommand ──────────────────────────────────────────────────────────

describe("dump subcommand", () => {
  test("outputs full .env content with section titles and actual values", async () => {
    const { stdout, exitCode } = await run(["dump"], {
      ".env.example": EXAMPLE,
      ".env": ENV_FULL,
    });
    expect(stdout).toContain("# Database");
    expect(stdout).toContain("DB_HOST=localhost");
    expect(exitCode).toBe(0);
  });

  test("exit 1 when a required var is missing", async () => {
    const { exitCode } = await run(["dump"], {
      ".env.example": EXAMPLE,
      ".env": ENV_MISSING_HOST,
    });
    expect(exitCode).toBe(1);
  });
});

// ─── explain subcommand ───────────────────────────────────────────────────────

describe("explain subcommand", () => {
  test("prints format reference and exits 0", async () => {
    const { stdout, exitCode } = await run(["explain"]);
    expect(stdout).toContain("check-env");
    expect(exitCode).toBe(0);
  });
});

// ─── --help / -h ──────────────────────────────────────────────────────────────

describe("--help / -h", () => {
  test("prints help and exits 0", async () => {
    const { stdout, exitCode } = await run(["--help"]);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--verbose");
    expect(exitCode).toBe(0);
  });

  test("-h is an alias for --help", async () => {
    const { stdout } = await run(["-h"]);
    expect(stdout).toContain("Usage:");
  });
});

// ─── error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  test("exits 1 with error message when .env.example is not found", async () => {
    const { stderr, exitCode } = await run([]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain(".env.example");
  });

  test("exits 1 with error when two display flags are combined", async () => {
    const { stderr, exitCode } = await run(["-q", "-s"], {
      ".env.example": EXAMPLE,
      ".env": ENV_FULL,
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("cannot be combined");
  });
});
