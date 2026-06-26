/** Minimal parser for pnpm-workspace.yaml — only needs the packages list */
export function parsePnpmWorkspace(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of content.split("\n")) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = /^\s+-\s+['"]?([^'"]+)['"]?/.exec(line);
      if (match) {
        const value = match[1]?.trim() ?? "";
        if (value && !value.startsWith("!")) patterns.push(value);
      } else if (/^\S/.test(line) && line.trim()) {
        break; // next top-level key
      }
    }
  }

  return patterns;
}

export function fuzzyMatch(str: string, query: string): boolean {
  let i = 0;
  for (const ch of str) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}
