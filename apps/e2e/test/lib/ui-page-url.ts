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

/** Matches apps/ohos MAIN_HTTP_ORIGIN (device-local UI HTTP server). */
export const HARMONYOS_UI_ORIGIN = 'http://127.0.0.1:18081/'

/** Default docker UI origin (host-mapped port 30000). Override with `E2E_DOCKER_UI_ORIGIN`. */
export const DEFAULT_DOCKER_UI_ORIGIN = 'http://localhost:30000/'

/** @deprecated Prefer resolveDockerUiOrigin() — kept for existing imports/tests. */
export const DOCKER_UI_ORIGIN = DEFAULT_DOCKER_UI_ORIGIN

/**
 * Docker UI origin for Host Runner WDIO / wait-ready.
 * `E2E_DOCKER_UI_ORIGIN` wins when set (trailing slash normalized).
 */
export function resolveDockerUiOrigin(): string {
  const fromEnv = process.env.E2E_DOCKER_UI_ORIGIN?.trim()
  if (!fromEnv) {
    return DEFAULT_DOCKER_UI_ORIGIN
  }
  return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
}

export type TestbedOs = 'general' | 'HarmonyOS'

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

function defaultBaseUrlForOs(os: TestbedOs): string {
  if (os === 'HarmonyOS') {
    return HARMONYOS_UI_ORIGIN
  }
  if (process.env.E2E_PLATFORM === 'docker') {
    return resolveDockerUiOrigin()
  }
  return `http://localhost:${readUiDevServerPort()}`
}

/**
 * @param url - Explicit page URL. When omitted, derived from `os`.
 * @param os - Target platform. Default `"general"` (Vite / desktop). `"HarmonyOS"` uses device-local 18081.
 */
export function resolveUiPageUrl(url?: string, os: TestbedOs = 'general'): string {
  const base = url ?? defaultBaseUrlForOs(os)
  const token = process.env.SMM_AUTH_TOKEN
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
