import { spawnSync } from "node:child_process";
import search from "../ui/mysearch";
import type { PickerMode } from "./config";
import { fuzzyMatch } from "../lib/fuzzy";
import { CliExitError } from "../errors";

interface PickerDeps {
  hasFzf: () => boolean;
  search: typeof search;
}

function defaultHasFzf(): boolean {
  return spawnSync("which", ["fzf"], { stdio: "ignore" }).status === 0;
}

export interface PickerCandidate {
  name: string;
  description: string;
}

export interface IPickerService {
  pick(candidates: PickerCandidate[], query: string, mode: PickerMode): Promise<string | undefined>;
}

export class PickerService implements IPickerService {
  constructor(
    private deps: PickerDeps = {
      hasFzf: defaultHasFzf,
      search,
    },
  ) {}

  async pick(
    candidates: PickerCandidate[],
    query: string,
    mode: PickerMode,
  ): Promise<string | undefined> {
    if (mode === "fzf" && this.deps.hasFzf()) {
      return this.pickWithFzf(candidates, query);
    }
    return this.pickWithInquirer(candidates, query);
  }

  private pickWithFzf(candidates: PickerCandidate[], query: string): string {
    const input = candidates.map((c) => `${c.name}\t${c.description}`).join("\n");

    const fzf = spawnSync(
      "fzf",
      [
        `--query=${query}`,
        "--delimiter=\t",
        "--with-nth=1",
        "--preview=echo {2..}",
        "--preview-window=bottom:1:wrap",
      ],
      { input, stdio: ["pipe", "pipe", "inherit"], encoding: "utf8" },
    );

    if (fzf.status !== 0) {
      throw new CliExitError("", fzf.status ?? 1, true);
    }

    // output is "name\tdescription", return only the name
    return (fzf.stdout as string).trim().split("\t")[0] ?? "";
  }

  private async pickWithInquirer(
    candidates: PickerCandidate[],
    query: string,
  ): Promise<string | undefined> {
    return this.deps.search<string | undefined>({
      message: "",
      initialInput: query,
      source: (input) => {
        const list = !input ? candidates : candidates.filter((c) => fuzzyMatch(c.name, input));
        return list.map((c) => ({ name: c.name, value: c.name, description: c.description }));
      },
      pageSize: 15,
    });
  }
}
