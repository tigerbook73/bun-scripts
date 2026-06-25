import type { ResolvedSection, ResolvedVar } from "./types";
import { ColorPalette } from "./color";
import { resolveVars } from "./resolver";
import { parseEnvExample } from "./parser";

export class EnvChecker {
  private readonly sections: ResolvedSection[];
  private readonly color: ColorPalette;

  constructor(options: { exampleContent: string; envFiles: string[]; color: ColorPalette }) {
    this.sections = resolveVars(parseEnvExample(options.exampleContent), options.envFiles);
    this.color = options.color;
  }

  private missingVars(): ResolvedVar[] {
    return this.sections
      .flatMap((s) => s.vars)
      .filter((v) => v.required && v.source === null && v.defaultValue === null);
  }

  hasMissing(): boolean {
    return this.missingVars().length > 0;
  }

  printVerbose(): void {
    const { sections, color } = this;
    let maxLen = 0;
    for (const s of sections)
      for (const v of s.vars)
        if (v.name.length > maxLen) maxLen = v.name.length;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]!;

      if (section.title) {
        if (i > 0) process.stdout.write("\n");
        for (const line of section.title.split("\n")) {
          console.log(color.comment(line));
        }
      } else if (i > 0) {
        console.log("");
      }

      for (const v of section.vars) {
        console.log(`${this.statusChar(v)}  ${v.name.padEnd(maxLen)}  ${this.sourceText(v)}`);
      }
    }
  }

  printMismatchOnly(): void {
    const { color } = this;
    for (const v of this.missingVars()) {
      console.log(`${color.error("✗")}  ${v.name}`);
    }
  }

  printSilent(): void {
    const missing = this.missingVars().map((v) => v.name);

    if (missing.length === 0) return;

    console.log("The following required variables are not configured:");
    for (const name of missing) {
      console.log(`  ${name}`);
    }
  }

  private statusChar(v: ResolvedVar): string {
    const { color } = this;
    if (v.source !== null) return color.ok("✓");
    if (!v.required || v.defaultValue !== null) return color.muted("—");
    return color.error("✗");
  }

  private sourceText(v: ResolvedVar): string {
    if (v.source !== null) return v.source;
    if (v.defaultValue !== null) return `(default: ${v.defaultValue})`;
    if (!v.required) return "(optional, not set)";
    return "(not set)";
  }
}
