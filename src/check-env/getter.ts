import type { ResolvedSection, ResolvedVar } from "./types";

function selectVars(sections: ResolvedSection[], keys: string[]): ResolvedVar[] {
  const allVars = sections.flatMap((s) => s.vars);
  if (keys.length === 0) return allVars.filter((v) => v.value !== null);

  const varMap = new Map(allVars.map((v) => [v.name, v]));
  const result: ResolvedVar[] = [];

  for (const k of keys) {
    const v = varMap.get(k);
    if (!v) {
      process.stderr.write(`Warning: "${k}" is not defined in .env.example\n`);
      continue;
    }
    if (v.value !== null) result.push(v);
    // silently skip keys that exist in example but are not configured
  }

  return result;
}

/** Outputs KEY=VALUE lines for configured vars. Always uses actual values (no masking). */
export function buildGetOutput(sections: ResolvedSection[], keys: string[]): string {
  return selectVars(sections, keys)
    .map((v) => `${v.name}=${v.value ?? ""}`)
    .join("\n");
}

/** Outputs a JSON object of var names to their actual values. */
export function buildJsonOutput(sections: ResolvedSection[], keys: string[]): string {
  const obj: Record<string, string> = {};
  for (const v of selectVars(sections, keys)) {
    obj[v.name] = v.value ?? "";
  }
  return JSON.stringify(obj, null, 2);
}
