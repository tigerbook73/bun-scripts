# `check-env` 最终需求文档 v2

## 一、工具定位

Bun 全局 CLI 工具。以项目根目录 `.env.example` 为 source of truth，检查 dev/prod 环境的环境变量配置完整性。零侵入，不修改任何文件。

---

## 二、`.env.example` 格式规范

### 2.1 区段结构

```bash
# 数据库配置
DB_HOST=
DB_PORT=5432

# 第三方服务
STRIPE_SK=<secret>
```

- **空行**分隔区段
- 区段内第一个 `KEY=` 之前的**连续 `#` 注释行**作为区段标题
- 区段内**既无 `KEY=` 也无 `# KEY=`**（纯注释区段）→ 整个区段忽略
- 输出严格遵循原始顺序

### 2.2 必填 vs 可选

```bash
DB_HOST=           # 必填
# FEATURE_FLAG=   # 可选（key 被注释掉）
```

- `KEY=` → 必填
- `# KEY=` → 可选，未设置不算错误，不影响 exit code

### 2.3 Value 语义标记

| value 写法           | 语义                             |
| -------------------- | -------------------------------- |
| 空（`KEY=`）         | 必填，无参考默认值               |
| 普通值（`KEY=5432`） | 必填，有参考默认值（展示用）     |
| `<secret>`           | 必填，敏感，输出脱敏             |
| `<number>`           | 必填，类型提示数字（预留校验）   |
| `<boolean>`          | 必填，类型提示布尔（预留校验）   |
| `<url>`              | 必填，类型提示 URL（预留校验）   |
| `<string>`           | 必填，类型提示字符串（通常省略） |
| 注释掉的任意写法     | 可选，value 作为参考默认值       |

标记可通过 inline 注释补充类型说明：

```bash
DB_PORT=5432           # number
ENABLE_CACHE=false     # boolean
# WEBHOOK_URL=<url>    # optional
```

### 2.4 Secret 识别

以下两种方式取并集，均触发脱敏：

- value 位置写了 `<secret>`
- 字段名（大小写不敏感）包含：`PASSWORD` / `SECRET` / `KEY` / `TOKEN` / `PASS`

### 2.5 脱敏规则

- 值长度 ≤ 4 → `****`
- 值长度 > 4 → 前 4 位 + `****`（`sk-abcdef` → `sk-a****`）
- 未设置 → 显示 `—`，不脱敏

### 2.6 其他解析规则

- 只支持 `#` 注释
- 带引号的值（`"value"` / `'value'`）剥除引号后展示，与标准 dotenv 一致
- Inline comment 剥除：`KEY=value # comment` 中取值为 `value`（`=` 后到 `#` 之前，去除首尾空格）
- 同一 key 多次出现 → 以最后一次为准，并输出警告
- 文件编码：仅支持 UTF-8

---

## 三、环境文件优先级

加载顺序从低到高，高优先级覆盖低优先级：

**dev：**
`.env` → `.env.local` → `.env.development` → `.env.development.local`

**prod：**
`.env` → `.env.production` → `.env.production.local`

- 文件不存在 → 跳过，不报错
- key 存在但值为空字符串 → **已配置**
- key 不存在于任何文件 → **未配置**
- 每个变量记录最终生效的来源文件

---

## 四、来源标记

每个变量的来源（`--real-file` 列）显示规则：

| 情况                              | 来源显示                    | 值显示              |
| --------------------------------- | --------------------------- | ------------------- |
| 在某 `.env.*` 文件中配置          | 该文件名（如 `.env.local`） | 实际值（含脱敏）    |
| 必填，未在任何文件配置            | `(not set)`                 | `—`                 |
| 可选，未配置，example 有参考值    | `(optional, not set)`       | `5432 (example)` 格式，标注来源不可靠 |
| 可选，未配置，example 无参考值    | `(optional, not set)`       | `—`                 |

> `example 值` 对必填变量仅作文档说明，不参与来源判断；可选变量的 example 值展示时加 ` (example)` 后缀标注。

---

## 五、CLI 接口

### 5.1 用法

```bash
check-env [--env dev|prod] [flags]
```

默认：`--env dev`，verbose 输出模式。

### 5.2 Flags

| Flag                          | 说明                                           |
| ----------------------------- | ---------------------------------------------- |
| `-h`, `--help`                | 输出帮助信息，exit 0                           |
| `--env dev\|prod`             | 指定环境，默认 `dev`                           |
| `--silent`                    | 有缺失时只输出缺失列表；无缺失时零输出         |
| `--mismatch-only`             | 只显示**必填且未配置**的变量，可选未设置不显示 |
| `--explain`                   | 输出理想 `.env.example` 格式说明模板           |
| `--explain --format markdown` | 以 markdown 格式输出（预留，暂不实现）         |

未知 flag → stderr 报错，exit 1。

> 当前版本**默认即 verbose**（显示区段标题、来源文件、实际取值），不再区分 `--verbose` / `--comments` / `--real-file` / `--real-value` 等细粒度 flag，后续按需补充。

### 5.3 Flag 组合规则

- `--silent` 与 `--mismatch-only` 同时使用 → 以 `--silent` 为准
- `--explain` 与其他 flag 同时使用 → 忽略其他 flag，只输出模板

---

## 六、输出格式（默认 verbose）

### 6.1 标准输出

```
数据库配置

  DB_HOST      ✗   (not set)              —
  DB_PORT      ✗   (not set)              —
  DB_PASSWORD  ✗   (not set)              —

第三方服务

  STRIPE_SK    ✓   .env.local             sk-a****
  API_KEY      ✗   (not set)              —

功能开关

  FEATURE_FLAG —   (optional, not set)    false (example)
  DEBUG_MODE   ✓   .env.development       true
```

列结构：`{NAME}   {✓/✗/—}   {来源}   {值}`

列对齐基于**当前区段内**最长 key 名，区段间重置。

### 6.2 `--mismatch-only`

只输出必填且未配置的变量，不显示区段标题：

```
✗  DB_HOST      (not set)
✗  DB_PASSWORD  (not set)
✗  API_KEY      (not set)
```

### 6.3 `--silent`

无缺失：零输出，exit 0。

有缺失：

```
The following required variables are not configured:
  DB_HOST
  DB_PASSWORD
  API_KEY
```

exit 1。

### 6.4 `--explain` 输出

输出一份带注释的格式模板，说明本工具支持的所有 `.env.example` 语法：

```bash
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

# 也可通过 inline 注释说明类型
TIMEOUT=30    # number, unit: seconds

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
# ────────────────────────────────────────
```

---

## 七、Exit Code

| 情况                      | Exit Code                   |
| ------------------------- | --------------------------- |
| 所有必填变量均已配置      | `0`                         |
| 存在未配置的必填变量      | `1`                         |
| `.env.example` 不存在     | `1`（输出错误信息）         |
| `.env.example` 有重复 key | `0`（输出警告，不视为错误） |

可选变量未配置不影响 exit code，所有模式统一遵循。

---

## 八、安装

使用本项目标准安装机制（`tools.config.json` + `bun run install:tools`）：

```json
{ "src": "src/check-env.ts", "name": "check-env", "dir": "~/.local/bin" }
```

```bash
bun run install:tools
```

---

## 九、预留功能（不在当前实现范围）

### 9.1 类型校验

当 `.env.example` 中声明了类型标记（`<number>` / `<boolean>` / `<url>`），校验实际值是否合法：

| 类型        | 合法判断                                |
| ----------- | --------------------------------------- |
| `<number>`  | `Number(value)` 不为 `NaN`              |
| `<boolean>` | `true/false/1/0/yes/no`（大小写不敏感） |
| `<url>`     | `new URL(value)` 不抛异常               |
| `<secret>`  | 不做格式校验                            |

类型不合法时：收集所有问题（缺失 + 类型错误）全量输出，exit 1。

### 9.2 输出细粒度控制

按需补充 `--comments` / `--real-file` / `--real-value` 等 flag，允许自由组合输出列。

### 9.3 `--explain --format markdown`

输出 markdown 格式的说明文档，可直接作为 `ENV.md` 提交到仓库。

### 9.4 颜色输出

✗ 红色、✓ 绿色、— 暗色；通过 `NO_COLOR` 环境变量或 `--no-color` flag 控制关闭。

---

## 十、Self Review

**已解决的问题：**

- ✅ `--silent` 语义明确（有缺失输出列表，无缺失零输出）
- ✅ 可选变量已设置时显示 `✓`，未设置显示 `—`（区别于必填的 `✗`）
- ✅ `--mismatch-only` 明确只针对必填未配置，可选不显示
- ✅ `--silent` 优先级高于 `--mismatch-only`
- ✅ example 值对必填变量不计入配置状态；可选变量的 example 值展示时加 ` (example)` 后缀

**仍需实现时注意的细节：**

1. **`<secret>` 与类型标记共存**：`STRIPE_SK=<secret>` 只标记敏感，类型默认 `string`；若需类型提示，通过 inline 注释补充（`STRIPE_SK=<secret> # url`），解析器需同时识别两者
2. **空行解析的边界**：连续多个空行视为同一个区段分隔符，不产生空区段
3. **`.env.example` 首行即 key**（无任何注释）：该变量归入"无标题区段"，输出时不显示区段标题行，直接列出变量
4. **Bun 自动加载行为**：Bun 运行时会自动注入 `.env`，工具需手动读取文件而非依赖 `process.env`，否则无法追踪来源文件
