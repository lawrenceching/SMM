/**
 * Resolve the UI Vite dev-server port from apps/ui/vite.config.ts (or a given path).
 *
 * Uses source parsing (not `vite.loadConfigFromFile`) so the helper works under
 * Bun, Node, and WDIO's Mocha loader without pulling in Vite's dual CJS/ESM exports.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VITE_DEFAULT_DEV_PORT = 5173;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_UI_VITE_CONFIG = path.join(ROOT, 'apps', 'ui', 'vite.config.ts');

/**
 * Parse `server.port` from a Vite config source string.
 */
export function parseViteDevServerPort(
  source: string,
  fallback: number = VITE_DEFAULT_DEV_PORT,
): number {
  const serverBlock = source.match(/server\s*:\s*\{([\s\S]*?)\}(?:\s*,|\s*\n)/);
  const block = serverBlock?.[1] ?? source;
  const portMatch = block.match(/\bport\s*:\s*(\d+)\b/);
  if (!portMatch) {
    return fallback;
  }
  const port = Number(portMatch[1]);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

export function readUiDevServerPort(
  viteConfigPath: string = DEFAULT_UI_VITE_CONFIG,
): number {
  const resolved = path.resolve(viteConfigPath);
  const source = fs.readFileSync(resolved, 'utf8');
  return parseViteDevServerPort(source);
}
