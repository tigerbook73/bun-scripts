import { spawnSync } from "node:child_process";
import search from "@inquirer/search";
import { ExitPromptError } from "@inquirer/core";
import Fuse from "fuse.js";

export function hasFzf(): boolean {
  return spawnSync("which", ["fzf"], { stdio: "ignore" }).status === 0;
}

function pickWithFzf(candidates: string[], query: string): string {
  const fzf = spawnSync("fzf", ["--query", query], {
    input: candidates.join("\n"),
    stdio: ["pipe", "pipe", "inherit"],
    encoding: "utf8",
  });

  if (fzf.status !== 0) {
    process.exit(fzf.status ?? 1);
  }

  return (fzf.stdout as string).trim();
}

async function pickWithInquirer(candidates: string[], query: string): Promise<string> {
  const fuse = new Fuse(candidates, { threshold: 0.4 });

  return search<string>({
    message: "Select a script",
    source: (input) => {
      const q = input ?? query;
      if (!q) return candidates.map((c) => ({ name: c, value: c }));
      return fuse.search(q).map((r) => ({ name: r.item, value: r.item }));
    },
    pageSize: 15,
  });
}

export async function pick(candidates: string[], query: string): Promise<string> {
  if (hasFzf()) {
    return pickWithFzf(candidates, query);
  }
  try {
    return await pickWithInquirer(candidates, query);
  } catch (err) {
    if (err instanceof ExitPromptError) {
      process.exit(1);
    }
    throw err;
  }
}
