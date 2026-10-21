#!/usr/bin/env node
// Builds the static site into dist/ (the folder GitHub Pages publishes).
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const out = join(root, "dist");

if (!existsSync(src)) {
  console.error(`build: missing source directory ${src}`);
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });

console.log(`build: copied ${src} -> ${out}`);
