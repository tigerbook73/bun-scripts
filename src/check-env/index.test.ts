/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Tests access array elements immediately after asserting their length — non-null assertions are safe here.
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  parseEnvExample,
  parseEnvFile,
  resolveVars,
  isSecret,
  maskValue,
  buildEnvContent,
  buildGetOutput,
  buildJsonOutput,
} from "./index";

function scaffold(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), "check-env-test-"));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true });
});

// ─── isSecret ─────────────────────────────────────────────────────────────────

describe("isSecret", () => {
  test("matches <secret> example value", () => {
    expect(isSecret("STRIPE_SK", "<secret>")).toBe(true);
  });

  test("matches PASSWORD in name", () => {
    expect(isSecret("DB_PASSWORD", null)).toBe(true);
  });

  test("matches SECRET in name (case-insensitive)", () => {
    expect(isSecret("jwt_secret", null)).toBe(true);
  });

  test("matches KEY in name", () => {
    expect(isSecret("API_KEY", null)).toBe(true);
  });

  test("matches TOKEN in name", () => {
    expect(isSecret("ACCESS_TOKEN", null)).toBe(true);
  });

  test("matches PASS in name", () => {
    expect(isSecret("REDIS_PASS", null)).toBe(true);
  });

  test("does not match non-secret name", () => {
    expect(isSecret("DB_HOST", null)).toBe(false);
  });

  test("non-secret example value does not trigger", () => {
    expect(isSecret("DB_HOST", "localhost")).toBe(false);
  });
});

// ─── maskValue ────────────────────────────────────────────────────────────────

describe("maskValue", () => {
  test("short value (≤4) → ****", () => {
    expect(maskValue("abc")).toBe("****");
    expect(maskValue("abcd")).toBe("****");
  });

  test("long value (>4) → first 4 + ****", () => {
    expect(maskValue("sk-abcdef")).toBe("sk-a****");
    expect(maskValue("12345")).toBe("1234****");
  });

  test("exactly 5 chars", () => {
    expect(maskValue("abcde")).toBe("abcd****");
  });
});

// ─── parseEnvFile ─────────────────────────────────────────────────────────────

describe("parseEnvFile", () => {
  test("parses basic KEY=VALUE", () => {
    const map = parseEnvFile("DB_HOST=localhost\nDB_PORT=5432\n");
    expect(map.get("DB_HOST")).toBe("localhost");
    expect(map.get("DB_PORT")).toBe("5432");
  });

  test("skips comment lines", () => {
    const map = parseEnvFile("# comment\nKEY=value\n");
    expect(map.has("# comment")).toBe(false);
    expect(map.get("KEY")).toBe("value");
  });

  test("skips empty lines", () => {
    const map = parseEnvFile("\nKEY=value\n\n");
    expect(map.size).toBe(1);
  });

  test("strips double quotes", () => {
    const map = parseEnvFile('KEY="hello world"');
    expect(map.get("KEY")).toBe("hello world");
  });

  test("strips single quotes", () => {
    const map = parseEnvFile("KEY='hello world'");
    expect(map.get("KEY")).toBe("hello world");
  });

  test("strips inline comment", () => {
    const map = parseEnvFile("KEY=value # this is a comment");
    expect(map.get("KEY")).toBe("value");
  });

  test("allows empty value", () => {
    const map = parseEnvFile("KEY=");
    expect(map.has("KEY")).toBe(true);
    expect(map.get("KEY")).toBe("");
  });

  test("later duplicate key wins", () => {
    const map = parseEnvFile("KEY=first\nKEY=second\n");
    expect(map.get("KEY")).toBe("second");
  });
});

// ─── parseEnvExample ──────────────────────────────────────────────────────────

describe("parseEnvExample", () => {
  test("parses a required variable", () => {
    const sections = parseEnvExample("DB_HOST=\n");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.vars[0]).toMatchObject({ name: "DB_HOST", required: true });
  });

  test("parses an optional variable", () => {
    const sections = parseEnvExample("# FEATURE=false\n");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.vars[0]).toMatchObject({
      name: "FEATURE",
      required: false,
      exampleValue: "false",
    });
  });

  test("section title from comment lines before first key", () => {
    const sections = parseEnvExample("# Database\nDB_HOST=\n");
    expect(sections[0]!.title).toBe("# Database");
  });

  test("multi-line comment preserves newlines and # markers in title", () => {
    const sections = parseEnvExample("# Line one\n# Line two\nKEY=\n");
    expect(sections[0]!.title).toBe("# Line one\n# Line two");
  });

  test("pure-comment section is ignored", () => {
    const input = "# Just a comment\n# Another comment\n\nKEY=value\n";
    const sections = parseEnvExample(input);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.vars[0]!.name).toBe("KEY");
  });

  test("commented duplicate of required key is silently ignored", () => {
    // KEY= (required) followed by # KEY= (commented alternative) → only one var, no warning
    const input = "KEY=value1\n# KEY=value2\n";
    const sections = parseEnvExample(input);
    expect(sections[0]!.vars).toHaveLength(1);
    expect(sections[0]!.vars[0]).toMatchObject({ name: "KEY", required: true });
  });

  test("blank lines separate sections", () => {
    const input = "# Section A\nA=\n\n# Section B\nB=\n";
    const sections = parseEnvExample(input);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.title).toBe("# Section A");
    expect(sections[1]!.title).toBe("# Section B");
  });

  test("consecutive blank lines treated as single separator", () => {
    const input = "A=\n\n\n\nB=\n";
    const sections = parseEnvExample(input);
    expect(sections).toHaveLength(2);
  });

  test("untitled section when file starts with a key", () => {
    const sections = parseEnvExample("KEY=value\n");
    expect(sections[0]!.title).toBeNull();
  });

  test("optional var with no example value", () => {
    const sections = parseEnvExample("# OPT=\n");
    expect(sections[0]!.vars[0]).toMatchObject({ required: false, exampleValue: null });
  });

  test("secret is auto-detected by name", () => {
    const sections = parseEnvExample("API_KEY=\n");
    expect(sections[0]!.vars[0]!.isSecret).toBe(true);
  });

  test("secret is auto-detected by <secret> marker", () => {
    const sections = parseEnvExample("STRIPE_SK=<secret>\n");
    expect(sections[0]!.vars[0]!.isSecret).toBe(true);
  });

  test("extracts defaultValue from inline comment", () => {
    const sections = parseEnvExample("TIMEOUT=30    # number, unit: seconds, default: 30\n");
    expect(sections[0]!.vars[0]).toMatchObject({
      name: "TIMEOUT",
      required: true,
      defaultValue: "30",
    });
  });

  test("no defaultValue when comment has no default:", () => {
    const sections = parseEnvExample("PORT=8080    # number\n");
    expect(sections[0]!.vars[0]!.defaultValue).toBeNull();
  });

  test("extracts defaultValue from optional var inline comment", () => {
    const sections = parseEnvExample("# LOG_LEVEL=info    # default: info\n");
    expect(sections[0]!.vars[0]).toMatchObject({ required: false, defaultValue: "info" });
  });

  test("captures inlineComment text for required var", () => {
    const sections = parseEnvExample("TIMEOUT=30    # number, unit: seconds, default: 30\n");
    expect(sections[0]!.vars[0]!.inlineComment).toBe("number, unit: seconds, default: 30");
  });

  test("captures inlineComment text for optional var", () => {
    const sections = parseEnvExample("# PORT=8080    # number\n");
    expect(sections[0]!.vars[0]!.inlineComment).toBe("number");
  });

  test("inlineComment is null when no inline comment", () => {
    const sections = parseEnvExample("DB_HOST=\n");
    expect(sections[0]!.vars[0]!.inlineComment).toBeNull();
  });

  test("extracts typeHint from <number> marker", () => {
    const sections = parseEnvExample("PORT=<number>\n");
    expect(sections[0]!.vars[0]!.typeHint).toBe("number");
  });

  test("extracts typeHint from <url> marker", () => {
    const sections = parseEnvExample("API_URL=<url>\n");
    expect(sections[0]!.vars[0]!.typeHint).toBe("url");
  });

  test("extracts typeHint from <boolean> marker", () => {
    const sections = parseEnvExample("ENABLE=<boolean>\n");
    expect(sections[0]!.vars[0]!.typeHint).toBe("boolean");
  });

  test("typeHint is null for <secret>", () => {
    const sections = parseEnvExample("STRIPE_SK=<secret>\n");
    expect(sections[0]!.vars[0]!.typeHint).toBeNull();
  });

  test("typeHint is null for plain values", () => {
    const sections = parseEnvExample("DB_PORT=5432\n");
    expect(sections[0]!.vars[0]!.typeHint).toBeNull();
  });
});

// ─── resolveVars ──────────────────────────────────────────────────────────────

describe("resolveVars", () => {
  test("resolves variable from .env file", () => {
    scaffold(tmpDir, { ".env": "DB_HOST=localhost\n" });
    const sections = parseEnvExample("DB_HOST=\n");
    const resolved = resolveVars(sections, [".env"]);
    const v = resolved[0]!.vars[0]!;
    expect(v.source).toBe(".env");
    expect(v.value).toBe("localhost");
  });

  test("higher priority file wins", () => {
    scaffold(tmpDir, {
      ".env": "KEY=base\n",
      ".env.local": "KEY=override\n",
    });
    const sections = parseEnvExample("KEY=\n");
    const resolved = resolveVars(sections, [".env", ".env.local"]);
    const v = resolved[0]!.vars[0]!;
    expect(v.source).toBe(".env.local");
    expect(v.value).toBe("override");
  });

  test("missing file is skipped without error", () => {
    scaffold(tmpDir, { ".env": "KEY=value\n" });
    const sections = parseEnvExample("KEY=\n");
    const resolved = resolveVars(sections, [".env", ".env.local"]);
    expect(resolved[0]!.vars[0]!.source).toBe(".env");
  });

  test("empty string value counts as configured", () => {
    scaffold(tmpDir, { ".env": "KEY=\n" });
    const sections = parseEnvExample("KEY=\n");
    const resolved = resolveVars(sections, [".env"]);
    const v = resolved[0]!.vars[0]!;
    expect(v.source).toBe(".env");
    expect(v.value).toBe("");
  });

  test("unconfigured required var has null source", () => {
    const sections = parseEnvExample("MISSING=\n");
    const resolved = resolveVars(sections, []);
    expect(resolved[0]!.vars[0]!.source).toBeNull();
  });

  test("optional var can also be resolved from env file", () => {
    scaffold(tmpDir, { ".env": "OPT=yes\n" });
    const sections = parseEnvExample("# OPT=\n");
    const resolved = resolveVars(sections, [".env"]);
    const v = resolved[0]!.vars[0]!;
    expect(v.source).toBe(".env");
    expect(v.value).toBe("yes");
  });

  test("required var with defaultValue and no source is not counted as missing", () => {
    const sections = parseEnvExample("TIMEOUT=30    # default: 30\n");
    const resolved = resolveVars(sections, []);
    const v = resolved[0]!.vars[0]!;
    expect(v.source).toBeNull();
    expect(v.defaultValue).toBe("30");
    // required but has app default — not a missing error
    const hasMissing = resolved.some((s) =>
      s.vars.some((vv) => vv.required && vv.source === null && vv.defaultValue === null),
    );
    expect(hasMissing).toBe(false);
  });

  test("typeValid is true when var is not set (no value to validate)", () => {
    const sections = resolveVars(parseEnvExample("PORT=<number>\n"), []);
    expect(sections[0]!.vars[0]!.typeValid).toBe(true);
  });

  test("typeValid is true when no typeHint declared", () => {
    scaffold(tmpDir, { ".env": "KEY=anything\n" });
    const sections = resolveVars(parseEnvExample("KEY=\n"), [".env"]);
    expect(sections[0]!.vars[0]!.typeValid).toBe(true);
  });

  test("typeValid is true for a value matching its typeHint", () => {
    scaffold(tmpDir, { ".env": "PORT=8080\n" });
    const sections = resolveVars(parseEnvExample("PORT=<number>\n"), [".env"]);
    expect(sections[0]!.vars[0]!.typeValid).toBe(true);
  });

  test("typeValid is false for a value failing its typeHint", () => {
    scaffold(tmpDir, { ".env": "PORT=not-a-number\n" });
    const sections = resolveVars(parseEnvExample("PORT=<number>\n"), [".env"]);
    expect(sections[0]!.vars[0]!.typeValid).toBe(false);
  });

  test("typeValid is false for invalid boolean", () => {
    scaffold(tmpDir, { ".env": "ENABLE=maybe\n" });
    const sections = resolveVars(parseEnvExample("ENABLE=<boolean>\n"), [".env"]);
    expect(sections[0]!.vars[0]!.typeValid).toBe(false);
  });

  test("typeValid is false for invalid url", () => {
    scaffold(tmpDir, { ".env": "API_URL=not-a-url\n" });
    const sections = resolveVars(parseEnvExample("API_URL=<url>\n"), [".env"]);
    expect(sections[0]!.vars[0]!.typeValid).toBe(false);
  });
});

// ─── buildEnvContent ──────────────────────────────────────────────────────────

describe("buildEnvContent", () => {
  test("outputs configured required var with actual value", () => {
    scaffold(tmpDir, { ".env": "DB_HOST=localhost\n" });
    const sections = resolveVars(parseEnvExample("DB_HOST=\n"), [".env"]);
    expect(buildEnvContent(sections)).toContain("DB_HOST=localhost");
  });

  test("outputs unconfigured required var as empty placeholder", () => {
    const sections = resolveVars(parseEnvExample("DB_HOST=\n"), []);
    expect(buildEnvContent(sections)).toContain("DB_HOST=");
  });

  test("outputs configured optional var as uncommented", () => {
    scaffold(tmpDir, { ".env": "OPT=yes\n" });
    const sections = resolveVars(parseEnvExample("# OPT=default\n"), [".env"]);
    expect(buildEnvContent(sections)).toContain("OPT=yes");
    expect(buildEnvContent(sections)).not.toContain("# OPT=");
  });

  test("keeps unconfigured optional var commented with example value", () => {
    const sections = resolveVars(parseEnvExample("# OPT=default\n"), []);
    expect(buildEnvContent(sections)).toContain("# OPT=default");
  });

  test("preserves inline comments", () => {
    scaffold(tmpDir, { ".env": "PORT=9000\n" });
    const sections = resolveVars(parseEnvExample("PORT=<number>  # number, unit: port\n"), [
      ".env",
    ]);
    const content = buildEnvContent(sections);
    expect(content).toContain("PORT=9000");
    expect(content).toContain("# number, unit: port");
  });

  test("preserves section title", () => {
    scaffold(tmpDir, { ".env": "DB_HOST=localhost\n" });
    const sections = resolveVars(parseEnvExample("# Database\nDB_HOST=\n"), [".env"]);
    expect(buildEnvContent(sections)).toContain("# Database");
  });

  test("separates sections with blank lines", () => {
    scaffold(tmpDir, { ".env": "A=1\nB=2\n" });
    const sections = resolveVars(parseEnvExample("A=\n\nB=\n"), [".env"]);
    expect(buildEnvContent(sections)).toMatch(/A=1\n\nB=2/);
  });
});

// ─── buildGetOutput / buildJsonOutput ─────────────────────────────────────────

describe("buildGetOutput", () => {
  test("outputs all configured vars when no keys specified", () => {
    scaffold(tmpDir, { ".env": "A=1\nB=2\n" });
    const sections = resolveVars(parseEnvExample("A=\nB=\n"), [".env"]);
    const out = buildGetOutput(sections, []);
    expect(out).toContain("A=1");
    expect(out).toContain("B=2");
  });

  test("filters to specified keys", () => {
    scaffold(tmpDir, { ".env": "A=1\nB=2\n" });
    const sections = resolveVars(parseEnvExample("A=\nB=\n"), [".env"]);
    const out = buildGetOutput(sections, ["A"]);
    expect(out).toContain("A=1");
    expect(out).not.toContain("B=");
  });

  test("skips unset vars even when key is specified", () => {
    const sections = resolveVars(parseEnvExample("A=\n# OPT=x\n"), []);
    const out = buildGetOutput(sections, ["OPT"]);
    expect(out).toBe("");
  });

  test("uses actual values without masking for secrets", () => {
    scaffold(tmpDir, { ".env": "API_KEY=secret123\n" });
    const sections = resolveVars(parseEnvExample("API_KEY=\n"), [".env"]);
    const out = buildGetOutput(sections, []);
    expect(out).toContain("API_KEY=secret123");
  });
});

describe("buildJsonOutput", () => {
  test("outputs valid JSON with all configured vars", () => {
    scaffold(tmpDir, { ".env": "A=1\nB=2\n" });
    const sections = resolveVars(parseEnvExample("A=\nB=\n"), [".env"]);
    const parsed = JSON.parse(buildJsonOutput(sections, []));
    expect(parsed).toMatchObject({ A: "1", B: "2" });
  });

  test("filters to specified keys in JSON output", () => {
    scaffold(tmpDir, { ".env": "A=1\nB=2\n" });
    const sections = resolveVars(parseEnvExample("A=\nB=\n"), [".env"]);
    const parsed = JSON.parse(buildJsonOutput(sections, ["A"]));
    expect(parsed).toMatchObject({ A: "1" });
    expect(parsed.B).toBeUndefined();
  });
});
