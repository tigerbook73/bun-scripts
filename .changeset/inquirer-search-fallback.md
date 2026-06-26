---
"@tigerbook/run-scripts": minor
---

Add built-in interactive picker fallback when fzf is not available. Uses a local fork of @inquirer/search with initialInput pre-fill and Escape-to-clear/cancel support. Always prints the full command before execution. Adds config file support (`~/.bun-scripts/setting.toml` and `.bun-scripts/setting.toml`) with `run-scripts.picker` option to prefer `"fzf"` or `"node"`.
