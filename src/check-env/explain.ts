import { ColorPalette } from "./color";

const TYPE_HINT_RE = /^<\w+>$/;

/** Colorize a single line of the --explain template output. */
function colorizeExplainLine(line: string, color: ColorPalette): string {
  if (!line.trim()) return line;

  // Comment lines (including optional # KEY=value)
  if (line.startsWith("#")) return color.comment(line);

  // KEY=... lines
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return line;

  const keyPart = line.slice(0, eqIdx);
  const afterEq = line.slice(eqIdx + 1);

  // Split value and inline comment (# ...)
  const hashIdx = afterEq.indexOf("#");
  const rawValue = hashIdx === -1 ? afterEq : afterEq.slice(0, hashIdx).trimEnd();
  const spacing = hashIdx === -1 ? "" : afterEq.slice(rawValue.length, hashIdx);
  const inlineComment = hashIdx === -1 ? "" : afterEq.slice(hashIdx);

  let coloredValue: string;
  if (!rawValue) {
    coloredValue = "";
  } else if (rawValue.trim() === "<secret>") {
    coloredValue = color.error(rawValue);
  } else if (TYPE_HINT_RE.test(rawValue.trim())) {
    coloredValue = color.typeHint(rawValue);
  } else {
    coloredValue = color.value(rawValue);
  }

  const coloredComment = inlineComment ? `${spacing}${color.comment(inlineComment)}` : "";
  return `${color.key(keyPart)}=${coloredValue}${coloredComment}`;
}

const EXPLAIN_TEMPLATE = `\
# check-env 格式说明
# 本文件展示 check-env 工具支持的完整 .env.example 语法
# 可直接复制作为新项目的 .env.example 起点
#
# 用法：check-env [--env dev|prod] [--silent] [--mismatch-only]

# ────────────────────────────────────────
# 必填变量（基础写法）
# ────────────────────────────────────────

# 无默认值，必须配置
REQUIRED_NO_DEFAULT=

# 有参考默认值（展示用，不自动注入）
REQUIRED_WITH_DEFAULT=5432

# ────────────────────────────────────────
# 类型提示
# ────────────────────────────────────────

# value 位置写 <type> 作为类型标记
PORT=<number>
ENABLE_FEATURE=<boolean>
API_ENDPOINT=<url>

# 也可通过 inline 注释说明类型和默认值
# default: X 表示应用内部有兜底值，未配置不报错
TIMEOUT=30    # number, unit: seconds, default: 30

# ────────────────────────────────────────
# 敏感变量（secret）
# ────────────────────────────────────────

# 方式一：value 写 <secret>，明确标记敏感
STRIPE_SK=<secret>

# 方式二：字段名含 KEY/SECRET/TOKEN/PASSWORD/PASS 自动识别
DATABASE_PASSWORD=
JWT_SECRET=

# ────────────────────────────────────────
# 可选变量（注释掉 key）
# ────────────────────────────────────────

# 注释掉整行 = 可选，未配置不报错
# FEATURE_FLAG=false
# WEBHOOK_URL=<url>
# OPTIONAL_SECRET=<secret>

# ────────────────────────────────────────
# 纯注释区段（无任何 key，check-env 会忽略此区段）
# ────────────────────────────────────────`;

export function printExplain(color: ColorPalette): void {
  for (const line of EXPLAIN_TEMPLATE.split("\n")) {
    console.log(colorizeExplainLine(line, color));
  }
}

export function printHelp(): void {
  console.log(`\
Usage: check-env [options] [mode] [KEYS...]

Validates that all required environment variables declared in .env.example
are configured in the current environment. Type hints are validated by default.

Global options:
  -h, --help            Show this help message
  -e, --env <name>      Environment to check (default: dev)
                        Built-in: dev, prod. Custom names infer their own file chain.
  -E, --example <path>  Path to .env.example (default: .env.example)
  --no-color            Disable color output
  --explain             Print .env.example format reference template

Check modes (default: verbose; mutually exclusive):
  -q, --quiet           Compact — status symbol and key name only
  -s, --silent          No output on success; list errors on failure
  -m, --mismatch        List only missing required vars and type errors

Output modes (run check first; exit 1 on errors; mutually exclusive with check modes):
  -g, --get [KEYS...]   Print KEY=VALUE lines for configured vars (all if no KEYS given)
      --json            Output JSON instead of KEY=VALUE (requires --get)
  -D, --dump            Print full .env to stdout (mirrors .env.example structure)
  -o, --output <file>   Write full .env to file
                        --dump and --output can be combined to write to both destinations.

Display modifier:
  --no-mask             Show secret values unmasked in check display modes

Environment file priority:
  dev:      .env → .env.local → .env.development → .env.development.local
  prod:     .env → .env.production → .env.production.local
  <custom>: .env → .env.<name> → .env.<name>.local

Examples:
  # Checking environment
  check-env                              verbose check for dev
  check-env -e prod -s                   silent CI check for prod
  check-env -q                           compact: one line per variable
  check-env --no-mask                    show actual secret values

  # Getting values
  check-env -g                           all configured vars (KEY=VALUE)
  env \$(check-env -g) node app.js        inject all vars into a subprocess
  check-env -g DB_HOST DB_PORT           specific keys only
  check-env -g --json                    JSON format for scripting

  # Generating .env files
  check-env --dump                       full .env to stdout
  check-env -o .env.development.full     write snapshot to file
  check-env --dump -o .env.full          stdout and file simultaneously

Exit codes:
  0  All checks pass (or --explain / --help used)
  1  Missing required vars, type errors, or .env.example not found
`);
}
