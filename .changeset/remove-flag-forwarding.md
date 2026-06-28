---
"@tigerbook/run-scripts": minor
---

Add `-p`/`--print-command` to resolve and print the command that would run without executing it. Replace `r --config init` with `r --init-config`, and parse `r` options only before the query. Also remove the special case that forwarded commands directly to the package manager when the first argument started with `-`.
