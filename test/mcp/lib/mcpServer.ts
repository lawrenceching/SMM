import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { listTools } from './mcpInspectorClient'

export interface McpServerHandle {
  /** MCP server URL, e.g. `http://127.0.0.1:<port>/mcp`. */
  url: string
  /** User data dir (`USER_DATA_DIR`) passed to the server process. */
  userDataDir: string
  /** App data dir (`APP_DATA_DIR`) passed to the server process. */
  appDataDir: string
  /** Stop the server and remove its temp dirs. */
  stop: () => Promise<void>
}

const READY_TIMEOUT_MS = 30_000

/**
 * Resolve the repo root from this file (`test/mcp/lib/` → repo root).
 */
export function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..', '..')
}

/**
 * Find a free TCP port for the MCP server by binding port 0 and closing.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () => new Response('ok'),
    })
    const port = srv.port
    srv.stop(true)
    resolvePort(port)
  })
}

/**
 * Start an isolated SMM MCP server via `smm mcp start`.
 *
 * Spawns `bun apps/cli/index.ts mcp start --port <free>` with isolated
 * `USER_DATA_DIR` / `APP_DATA_DIR` / `LOG_DIR` temp dirs, waits for the
 * server to become ready, and returns a handle for teardown.
 */
export async function startMcpServer(): Promise<McpServerHandle> {
  const baseDir = await mkdtemp(join(tmpdir(), 'smm-mcp-'))
  // The real app keeps app data (metadata/plans) alongside user config on
  // Windows/macOS. Core routes metadata writes to `appDataDir`, while
  // `getCore()` resolves `appDataDir = getUserDataDir()` — so point both at
  // the same dir to mirror production and keep scrape/metadata consistent.
  const userDataDir = join(baseDir, 'user-data')
  const appDataDir = userDataDir
  const logDir = join(baseDir, 'logs')

  const root = repoRoot()
  const port = await findFreePort()
  const cliEntry = join(root, 'apps', 'cli', 'index.ts')

  const child = spawn(
    process.execPath,
    [cliEntry, 'mcp', 'start', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        USER_DATA_DIR: userDataDir,
        APP_DATA_DIR: appDataDir,
        LOG_DIR: logDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  const url = `http://127.0.0.1:${port}/mcp`

  // Wait until the MCP endpoint answers `tools/list` successfully.
  const deadline = Date.now() + READY_TIMEOUT_MS
  let ready = false
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `smm mcp start exited early (code ${child.exitCode}): ${stderr.slice(0, 2000)}`,
      )
    }
    try {
      const tools = await listTools(url)
      if (tools.length > 0) {
        ready = true
        break
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  if (!ready) {
    child.kill()
    await rm(baseDir, { recursive: true, force: true })
    throw new Error(`smm mcp start did not become ready in ${READY_TIMEOUT_MS}ms: ${stderr.slice(0, 2000)}`)
  }

  return {
    url,
    userDataDir,
    appDataDir,
    stop: async () => {
      child.kill()
      await new Promise((r) => child.once('exit', r))
      await rm(baseDir, { recursive: true, force: true })
    },
  }
}
