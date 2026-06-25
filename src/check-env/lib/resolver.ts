/**
 * @file lib/resolver.ts
 * @description Resolves env variable sources and values by loading
 *   env files in priority order (low → high).
 */

import { existsSync, readFileSync } from "node:fs";
import type { ExampleSection, ResolvedSection, ResolvedVar } from "./types";
import { parseEnvFile } from "./parser";

function validateTypeHint(value: string, hint: string): boolean {
  const v = value.trim();
  switch (hint) {
    case "number":
      return v !== "" && !isNaN(Number(v));
    case "boolean":
      return ["true", "false", "yes", "no", "0", "1"].includes(v.toLowerCase());
    case "url": {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }
    default:
      return true;
  }
}

/** Returns the ordered list of env files to load for the given environment name. */
export function getEnvFiles(env: string): string[] {
  if (env === "dev") return [".env", ".env.local", ".env.development", ".env.development.local"];
  if (env === "prod") return [".env", ".env.production", ".env.production.local"];
  return [".env", `.env.${env}`, `.env.${env}.local`];
}

/**
 * Loads env files in priority order (low → high) and resolves each variable's
 * source file and actual value.
 */
export function resolveVars(sections: ExampleSection[], envFiles: string[]): ResolvedSection[] {
  const resolved = new Map<string, { value: string; source: string }>();
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const [key, value] of parseEnvFile(content)) {
      resolved.set(key, { value, source: file });
    }
  }

  return sections.map((section) => ({
    title: section.title,
    vars: section.vars.map((v): ResolvedVar => {
      const entry = resolved.get(v.name);
      const value = entry?.value ?? null;
      const typeValid =
        value === null || v.typeHint === null || validateTypeHint(value, v.typeHint);
      return { ...v, source: entry?.source ?? null, value, typeValid };
    }),
  }));
}
