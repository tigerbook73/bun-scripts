---
"@tigerbook/run-scripts": minor
---

Add `@inquirer/search` as interactive picker fallback when fzf is not available. Uses fuse.js for fuzzy matching in the inquirer picker. Always prints the full command before execution. Refactors source into focused modules (detect, collect, run, picker).
