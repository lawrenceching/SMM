import { afterAll, beforeAll } from 'vitest'
import { startMcpServer, type McpServerHandle } from './mcpServer'
import { resolveDockerContainerName } from './remoteDocker'
import { fetchRemoteHello } from './remoteHttp'

export interface McpTestContext {
  /** Present for local spawned servers; omitted when attaching remotely. */
  server?: McpServerHandle
  url: string
  userDataDir: string
  appDataDir: string
  isRemote: boolean
  httpServerAddress?: string
  authToken?: string
  containerName?: string
}

export type McpTestContextHandle = McpTestContext & {
  stop: () => Promise<void>
}

/**
 * Resolve an MCP test context: spawn an isolated CLI MCP server, or attach
 * to `MCP_SERVER_ADDRESS` when `TARGET=remote`.
 */
export async function createMcpTestContext(): Promise<McpTestContextHandle> {
  if (process.env.TARGET === 'remote') {
    const url = process.env.MCP_SERVER_ADDRESS!
    const http = process.env.HTTP_SERVER_ADDRESS!
    const token = process.env.SMM_AUTH_TOKEN!
    const hello = await fetchRemoteHello(http, token)
    return {
      url,
      userDataDir: hello.userDataDir,
      appDataDir: hello.appDataDir,
      isRemote: true,
      httpServerAddress: http,
      authToken: token,
      containerName: resolveDockerContainerName(),
      stop: async () => {},
    }
  }

  const server = await startMcpServer()
  return {
    server,
    url: server.url,
    userDataDir: server.userDataDir,
    appDataDir: server.appDataDir,
    isRemote: false,
    stop: () => server.stop(),
  }
}

/**
 * Register `beforeAll`/`afterAll` hooks that resolve an MCP test context
 * (`createMcpTestContext`) and tear it down afterwards.
 */
export function useMcpServer(): McpTestContext {
  const ctx: McpTestContext = {
    url: '',
    userDataDir: '',
    appDataDir: '',
    isRemote: false,
  }
  let stop: () => Promise<void> = async () => {}
  beforeAll(async () => {
    const created = await createMcpTestContext()
    ctx.server = created.server
    ctx.url = created.url
    ctx.userDataDir = created.userDataDir
    ctx.appDataDir = created.appDataDir
    ctx.isRemote = created.isRemote
    ctx.httpServerAddress = created.httpServerAddress
    ctx.authToken = created.authToken
    ctx.containerName = created.containerName
    stop = created.stop
  })
  afterAll(async () => {
    await stop()
  })
  return ctx
}
