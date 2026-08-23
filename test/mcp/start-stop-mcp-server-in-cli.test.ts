import { afterEach, describe, expect, it } from 'bun:test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UserConfig } from '@smm/core/types'
import { listTools } from './lib/mcpInspectorClient'
import { findFreePort, repoRoot } from './lib/mcpServer'

const READY_TIMEOUT_MS = 30_000
const STOP_TIMEOUT_MS = 10_000

interface CliMcpProcess {
  child: ChildProcess
  baseDir: string
  userDataDir: string
  host: string
  port: number
  url: string
  stdout: string
  cleanup: () => Promise<void>
}

async function readUserConfig(userDataDir: string): Promise<UserConfig> {
  const raw = await readFile(join(userDataDir, 'smm.json'), 'utf-8')
  return JSON.parse(raw) as UserConfig
}

async function waitForMcpReady(
  child: ChildProcess,
  url: string,
  getStdout: () => string,
  getStderr: () => string,
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const stdout = getStdout()
    const stderr = getStderr()
    if (child.exitCode !== null) {
      throw new Error(
        `smm mcp start exited early (code ${child.exitCode}): ${stderr.slice(0, 2000)}`,
      )
    }
    if (stdout.includes('MCP server started at')) {
      try {
        const tools = await listTools(url)
        if (tools.length > 0) {
          return
        }
      } catch {
        // server not ready yet
      }
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(
    `smm mcp start did not become ready in ${READY_TIMEOUT_MS}ms: stdout=${getStdout().slice(-1000)} stderr=${getStderr().slice(-1000)}`,
  )
}

/**
 * Spawn `bun apps/cli/index.ts mcp start` with an isolated user data dir.
 */
async function spawnMcpStart(options?: {
  host?: string
  port?: number
}): Promise<CliMcpProcess> {
  const baseDir = await mkdtemp(join(tmpdir(), 'smm-mcp-cli-'))
  const userDataDir = join(baseDir, 'user-data')
  const logDir = join(baseDir, 'logs')
  const host = options?.host ?? '127.0.0.1'
  const port = options?.port ?? (await findFreePort())

  const root = repoRoot()
  const cliEntry = join(root, 'apps', 'cli', 'index.ts')

  let stdout = ''
  let stderr = ''

  const child = spawn(
    process.execPath,
    [cliEntry, 'mcp', 'start', '--host', host, '-p', String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        USER_DATA_DIR: userDataDir,
        APP_DATA_DIR: userDataDir,
        LOG_DIR: logDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  const url = `http://${host}:${port}/mcp`
  await waitForMcpReady(child, url, () => stdout, () => stderr)

  return {
    child,
    baseDir,
    userDataDir,
    host,
    port,
    url,
    stdout,
    cleanup: async () => {
      if (child.exitCode === null) {
        child.kill()
        await Promise.race([
          new Promise((resolve) => child.once('exit', resolve)),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ])
      }
      await rm(baseDir, { recursive: true, force: true })
    },
  }
}

async function stopMcpProcess(proc: CliMcpProcess): Promise<number | null> {
  if (proc.child.exitCode !== null) {
    return proc.child.exitCode
  }
  proc.child.kill('SIGINT')
  return new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for smm mcp start to exit after SIGINT')),
      STOP_TIMEOUT_MS,
    )
    proc.child.once('exit', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })
}

describe('CLI smm mcp start/stop', () => {
  let proc: CliMcpProcess | undefined

  afterEach(async () => {
    if (proc) {
      await proc.cleanup()
      proc = undefined
    }
  })

  it('starts the MCP server, prints the startup message, and persists enableMcpServer', async () => {
    proc = await spawnMcpStart()

    expect(proc.stdout).toContain(`MCP server started at ${proc.url}`)
    expect(proc.stdout).toContain('using protocol is Streamable HTTP')

    const config = await readUserConfig(proc.userDataDir)
    expect(config.enableMcpServer).toBe(true)
    expect(config.mcpHost).toBe('127.0.0.1')
    expect(config.mcpPort).toBe(proc.port)

    const tools = await listTools(proc.url)
    expect(tools).toContain('readme')
  })

  it('persists custom --host and -p into smm.json', async () => {
    const port = await findFreePort()
    proc = await spawnMcpStart({ host: '127.0.0.1', port })

    expect(proc.stdout).toContain(`http://127.0.0.1:${port}/mcp`)

    const config = await readUserConfig(proc.userDataDir)
    expect(config.mcpHost).toBe('127.0.0.1')
    expect(config.mcpPort).toBe(port)
  })

  it.skipIf(process.platform === 'win32')(
    'sets enableMcpServer to false after SIGINT (graceful stop)',
    async () => {
      proc = await spawnMcpStart()

      const runningConfig = await readUserConfig(proc.userDataDir)
      expect(runningConfig.enableMcpServer).toBe(true)

      await stopMcpProcess(proc)

      const stoppedConfig = await readUserConfig(proc.userDataDir)
      expect(stoppedConfig.enableMcpServer).toBe(false)

      proc.cleanup = async () => {
        await rm(proc!.baseDir, { recursive: true, force: true })
      }
    },
  )
})
