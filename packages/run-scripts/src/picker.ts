import { spawnSync } from "node:child_process";
import search from "./ui/mysearch";
import type { PickerMode } from "./config";
import { fuzzyMatch, type PackageManager } from "./detect";
import type { ScriptEntry } from "./collect";
import { buildRunArgs } from "./run";

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

async function pickWithInquirer(
  candidates: string[],
  query: string,
  pm: PackageManager,
  scriptsMap: Map<string, ScriptEntry>,
): Promise<string | undefined> {
  return search<string | undefined>({
    message: "",
    initialInput: query,
    source: (input) => {
      const q = input;
      const list = !q ? candidates : candidates.filter((c) => fuzzyMatch(c, q));
      return list.map((c) => {
        const entry = scriptsMap.get(c);
        const cmd = entry
          ? `${pm} ${buildRunArgs(pm, entry.filter, entry.script, []).join(" ")}`
          : `${pm} run ${c}`;
        return { name: c, value: c, description: `Run: ${cmd}` };
      });
    },
    theme: {
      style: {
        keysHelpTip: () => undefined,
      },
    },
    pageSize: 15,
  });
}

export async function pick(
  candidates: string[],
  query: string,
  mode: PickerMode,
  pm: PackageManager,
  scriptsMap: Map<string, ScriptEntry>,
): Promise<string | undefined> {
  if (mode === "fzf" && hasFzf()) {
    return pickWithFzf(candidates, query);
  }
  return pickWithInquirer(candidates, query, pm, scriptsMap);
}
