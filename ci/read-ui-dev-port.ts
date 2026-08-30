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
 * Also accepts `DEFAULT_UI_DEV_PORT = 8000` when `port` is computed from env.
 */
export function parseViteDevServerPort(
  source: string,
  fallback: number = VITE_DEFAULT_DEV_PORT,
): number {
  const serverBlock = source.match(/server\s*:\s*\{([\s\S]*?)\}(?:\s*,|\s*\n)/);
  const block = serverBlock?.[1] ?? source;
  const portMatch = block.match(/\bport\s*:\s*(\d+)\b/);
  const defaultMatch = source.match(/\bDEFAULT_UI_DEV_PORT\s*=\s*(\d+)\b/);
  const raw = portMatch?.[1] ?? defaultMatch?.[1];
  if (!raw) {
    return fallback;
  }
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

function parseEnvPort(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return undefined;
  }
  return port;
}

export function readUiDevServerPort(
  viteConfigPath: string = DEFAULT_UI_VITE_CONFIG,
): number {
  const fromEnv = parseEnvPort(process.env.UI_PORT);
  if (fromEnv !== undefined) {
    return fromEnv;
  }
  const resolved = path.resolve(viteConfigPath);
  const source = fs.readFileSync(resolved, 'utf8');
  return parseViteDevServerPort(source);
}
