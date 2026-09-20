import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Port the MCP server binds when `smm.json` omits `mcpPort`.
 * Matches `DEFAULT_MCP_PORT` in `apps/core/src/pipeline/mcpServer.ts`.
 */
export const DEFAULT_RESERVED_MCP_PORT = 30001

/**
 * MCP listen port implied by a parsed `smm.json`.
 * core-routes may use any free port; this one is reserved for the user-facing MCP server.
 */
export function reservedMcpPortFromUserConfig(raw: unknown): number {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_RESERVED_MCP_PORT
  }
  const port = (raw as { mcpPort?: unknown }).mcpPort
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_RESERVED_MCP_PORT
  }
  return port
}

/**
 * `smm.json` path used by the bundled CLI (`getUserDataDir` in `apps/cli`).
 * Electron's `userData` directory is not the same folder on Linux.
 */
export function cliUserConfigPath(input: {
  platform: NodeJS.Platform
  homedir: string
  env: NodeJS.ProcessEnv
}): string {
  const pathApi = input.platform === 'win32' ? path.win32 : path.posix
  const dirFromEnv = input.env.USER_DATA_DIR
  if (dirFromEnv) {
    return pathApi.join(dirFromEnv, 'smm.json')
  }

  switch (input.platform) {
    case 'win32':
      return pathApi.join(
        input.env.APPDATA ?? pathApi.join(input.homedir, 'AppData', 'Roaming'),
        'SMM',
        'smm.json',
      )
    case 'darwin':
      return pathApi.join(input.homedir, 'Library', 'Application Support', 'SMM', 'smm.json')
    case 'linux':
      return pathApi.join(
        input.env.XDG_CONFIG_HOME ?? pathApi.join(input.homedir, '.config'),
        'smm',
        'smm.json',
      )
    default:
      return pathApi.join(input.homedir, '.config', 'smm', 'smm.json')
  }
}

/** Reads `mcpPort` from `smm.json`. Missing or unreadable config reserves the default port. */
export function readReservedMcpPort(configPath: string): number {
  let text: string
  try {
    text = readFileSync(configPath, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn(`[SMM] failed to read user config at ${configPath}:`, error)
    }
    return DEFAULT_RESERVED_MCP_PORT
  }

  try {
    return reservedMcpPortFromUserConfig(JSON.parse(text) as unknown)
  } catch (error) {
    console.warn(`[SMM] failed to parse user config at ${configPath}:`, error)
    return DEFAULT_RESERVED_MCP_PORT
  }
}
