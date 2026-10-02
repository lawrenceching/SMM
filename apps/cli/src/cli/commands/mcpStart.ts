import { mkdir } from 'node:fs/promises'
import { getCore } from '../../core/getCore'

export async function mcpStart(options: { host?: string; port?: string }): Promise<number> {
  try {
    // Lazy imports: pulling in the MCP lifecycle manager (and thus
    // `@smm/core-routes`) at module load breaks vitest's CLI unit tests
    // which don't alias `@smm/utils/path`.
    const { getAppDataDir, getLogDir, getUserDataDir } = await import('@/utils/config')

    await mkdir(getUserDataDir(), { recursive: true })
    await mkdir(getAppDataDir(), { recursive: true })
    await mkdir(getLogDir(), { recursive: true })

    const core = getCore()
    const state = await core.startMcpServer(
      {
        hostname: options.host,
        port: options.port ? Number(options.port) : undefined,
      },
      { persistUserConfig: true },
    )
    if (state.status !== 'running' || !state.url) {
      throw new Error(state.error ?? 'MCP server failed to start')
    }
    console.log(
      `MCP server started at ${state.url} using protocol is Streamable HTTP`,
    )

    // Keep the process alive until interrupted, then stop the server gracefully.
    await new Promise<void>((resolve) => {
      let stopping = false
      const shutdown = async () => {
        if (stopping) {
          return
        }
        stopping = true
        try {
          await core.stopMcpServer({ persistUserConfig: true })
        } finally {
          resolve()
        }
      }
      const onSignal = () => {
        void shutdown()
      }
      process.once('SIGINT', onSignal)
      process.once('SIGTERM', onSignal)
      if (process.platform === 'win32') {
        process.once('SIGBREAK', onSignal)
      }
    })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}
