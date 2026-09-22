import { spawn } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
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

/** Repo root from `apps/e2e/mcp/lib/`. */
export function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..', '..', '..')
}

/** Absolute path to the built CLI binary (`apps/cli/dist/cli[.exe]`). */
export function cliBinaryPath(): string {
  const isWindows = process.platform === 'win32'
  return join(repoRoot(), 'apps', 'cli', 'dist', isWindows ? 'cli.exe' : 'cli')
}

/**
 * Find a free TCP port for the MCP server by binding port 0 and closing.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    try {
      const srv = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: () => new Response('ok'),
      })
      const port = srv.port
      srv.stop(true)
      resolvePort(port)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Start an isolated SMM MCP server via the built CLI: `cli mcp start`.
 *
 * Spawns `apps/cli/dist/cli[.exe] mcp start --host 127.0.0.1 --port <free>`
 * with isolated `USER_DATA_DIR` / `APP_DATA_DIR` / `LOG_DIR` temp dirs,
 * waits for the server to become ready, and returns a handle for teardown.
 */
export async function startMcpServer(): Promise<McpServerHandle> {
  const binary = cliBinaryPath()
  if (!existsSync(binary)) {
    throw new Error(
      `CLI binary not found: ${binary}. Run: pnpm --filter cli run build`,
    )
  }
  if (process.platform !== 'win32') {
    chmodSync(binary, 0o755)
  }

  const baseDir = await mkdtemp(join(tmpdir(), 'smm-mcp-e2e-'))
  const userDataDir = join(baseDir, 'user-data')
  const appDataDir = userDataDir
  const logDir = join(baseDir, 'logs')

  const port = await findFreePort()

  const child = spawn(
    binary,
    ['mcp', 'start', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: repoRoot(),
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
    throw new Error(
      `smm mcp start did not become ready in ${READY_TIMEOUT_MS}ms: ${stderr.slice(0, 2000)}`,
    )
  }

  return {
    url,
    userDataDir,
    appDataDir,
    stop: async () => {
      if (child.exitCode === null) {
        await new Promise<void>((resolveExit) => {
          let settled = false
          const done = () => {
            if (!settled) {
              settled = true
              resolveExit()
            }
          }
          child.once('exit', done)
          child.kill()
          // Fallback if the process ignores SIGTERM on Windows.
          setTimeout(() => {
            if (child.exitCode === null) {
              child.kill('SIGKILL')
            }
            done()
          }, 5_000)
        })
      }
      await rm(baseDir, { recursive: true, force: true })
    },
  }
}
