#!/usr/bin/env bun

import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

interface ToolEntry {
  src: string;
  name: string;
  dir: string;
}

const projectRoot = resolve(import.meta.dir, "..");
const config: ToolEntry[] = await Bun.file(resolve(projectRoot, "tools.config.json")).json();

for (const tool of config) {
  const srcPath = resolve(projectRoot, tool.src);
  const targetDir = tool.dir.replace(/^~/, process.env["HOME"] ?? "");
  const targetPath = resolve(targetDir, tool.name);

  if (!existsSync(srcPath)) {
    console.error(`  ✗ source not found: ${srcPath}`);
    continue;
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  await Bun.$`chmod +x ${srcPath}`.quiet();
  await Bun.$`ln -sf ${srcPath} ${targetPath}`.quiet();
  console.log(`  ✓ ${tool.name}  ${targetPath} -> ${srcPath}`);
}
