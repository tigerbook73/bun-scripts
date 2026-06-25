import type { ResolvedSection } from "./types";

/**
 * Reconstructs a full .env file content from resolved sections,
 * mirroring the .env.example structure with actual values substituted.
 *
 * - Required vars: written as KEY=value (actual value, or empty if unset)
 * - Optional vars that are configured: written as KEY=value
 * - Optional vars that are not configured: written as commented # KEY=exampleValue
 * - Section titles and inline comments are preserved.
 */
export function buildEnvContent(sections: ResolvedSection[]): string {
  const lines: string[] = [];

  for (const [i, section] of sections.entries()) {
    if (i > 0) lines.push("");

    if (section.title) {
      for (const line of section.title.split("\n")) {
        lines.push(line);
      }
    }

    for (const v of section.vars) {
      const suffix = v.inlineComment ? `  # ${v.inlineComment}` : "";

      if (!v.required && v.source === null) {
        // Optional, not configured: keep commented with example value
        const exVal = v.exampleValue ?? "";
        lines.push(`# ${v.name}=${exVal}${suffix}`);
      } else {
        // Required (set or placeholder), or optional but configured
        const val = v.value ?? "";
        lines.push(`${v.name}=${val}${suffix}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}
