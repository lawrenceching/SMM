import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * `.env.local` paths from `startDir` up to the filesystem root (nearest first).
 */
export function findEnvLocalFiles(startDir: string): string[] {
  const files: string[] = [];
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, '.env.local');
    if (existsSync(candidate)) files.push(candidate);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return files;
}

/** Minimal dotenv-style parser (no external dependency in ci/). */
export function parseEnvLocalFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!key) {
      continue;
    }
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Load every `.env.local` from `startDir` to the repo/filesystem root.
 * Nearer files override farther ones. Existing `process.env` keys are not overwritten.
 */
export function loadEnvLocal(startDir: string = process.cwd()): Record<string, string> {
  const files = findEnvLocalFiles(startDir);
  const merged: Record<string, string> = {};
  for (const file of [...files].reverse()) {
    Object.assign(merged, parseEnvLocalFile(readFileSync(file, 'utf8')));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return merged;
}
