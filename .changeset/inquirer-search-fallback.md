---
"@tigerbook/run-scripts": minor
---

Add `@inquirer/search` as interactive picker fallback when fzf is not available. Uses fuse.js for fuzzy matching in the inquirer picker. Always prints the full command before execution. Refactors source into focused modules (detect, collect, run, picker, config). Adds config file support (`~/.bun-scripts/setting.json` and `.bun-scripts/setting.json`) with `run-scripts.picker` option to prefer `"fzf"` or `"inquirer"`.
