/**
 * Build the URL used by e2e to open the UI.
 *
 * Port is parsed from apps/ui/vite.config.ts locally (no import from ci/),
 * because WDIO's Mocha ESM loader fails on named exports from ../../../../ci
 * modules that previously pulled in Vite.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const VITE_DEFAULT_DEV_PORT = 5173

const UI_VITE_CONFIG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../ui/vite.config.ts',
)

function parseViteDevServerPort(source: string): number {
  const serverBlock = source.match(/server\s*:\s*\{([\s\S]*?)\}(?:\s*,|\s*\n)/)
  const block = serverBlock?.[1] ?? source
  const portMatch = block.match(/\bport\s*:\s*(\d+)\b/)
  if (!portMatch) {
    return VITE_DEFAULT_DEV_PORT
  }
  const port = Number(portMatch[1])
  return Number.isFinite(port) && port > 0 ? port : VITE_DEFAULT_DEV_PORT
}

export function readUiDevServerPort(
  viteConfigPath: string = UI_VITE_CONFIG,
): number {
  const source = fs.readFileSync(path.resolve(viteConfigPath), 'utf8')
  return parseViteDevServerPort(source)
}

export function resolveUiPageUrl(url?: string): string {
  const base = url ?? `http://localhost:${readUiDevServerPort()}`
  const token = process.env.SMM_AUTH_TOKEN
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
