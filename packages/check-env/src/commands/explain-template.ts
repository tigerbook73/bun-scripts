export const EXPLAIN_TEMPLATE = `\
# check-env format reference
# This file demonstrates the full .env.example syntax supported by check-env.
# Copy it as a starting point for a new project's .env.example.
#
# Usage: check-env [check] [-v|-q|-s|-m] [--env dev|prod]

# ────────────────────────────────────────
# Required variables (basic syntax)
# ────────────────────────────────────────

# No default — must be configured
REQUIRED_NO_DEFAULT=

# Reference default (for display only, not injected automatically)
REQUIRED_WITH_DEFAULT=5432

# ────────────────────────────────────────
# Type hints
# ────────────────────────────────────────

# Write <type> as the value to declare a type hint; also inferred from defaults or examples
PORT=<number>
ENABLE_FEATURE=<boolean>
API_ENDPOINT=<url>

# number / boolean / url are inferred automatically; plain strings are not
PORT=5432
FEATURE_FLAG=false
PUBLIC_URL=https://example.com

# "default: X" in an inline comment means the app has a built-in fallback — missing is not an error
TIMEOUT=30    # number, unit: seconds, default: 30

# ────────────────────────────────────────
# Secret variables
# ────────────────────────────────────────

# Option 1: write <secret> as the value to explicitly mark as sensitive
STRIPE_SK=<secret>

# Option 2: names containing KEY/SECRET/TOKEN/PASSWORD/PASS are auto-detected
DATABASE_PASSWORD=
JWT_SECRET=

# ────────────────────────────────────────
# Optional variables (commented-out keys)
# ────────────────────────────────────────

# Comment out the entire line to mark as optional — missing is not an error
# FEATURE_FLAG=false
# WEBHOOK_URL=<url>
# OPTIONAL_SECRET=<secret>

# ────────────────────────────────────────
# Comment-only sections (no keys — ignored by check-env)
# ────────────────────────────────────────`;
