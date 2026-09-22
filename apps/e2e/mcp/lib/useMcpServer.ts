import { afterAll, beforeAll } from 'bun:test'
import { startMcpServer, type McpServerHandle } from './mcpServer'

export interface McpTestContext {
  server: McpServerHandle
  url: string
  userDataDir: string
  appDataDir: string
}

/**
 * Register `beforeAll`/`afterAll` hooks that start an isolated MCP server
 * via the built CLI binary and tear it down afterwards.
 */
export function useMcpServer(): McpTestContext {
  const ctx: McpTestContext = {
    server: undefined as unknown as McpServerHandle,
    url: '',
    userDataDir: '',
    appDataDir: '',
  }
  beforeAll(async () => {
    const server = await startMcpServer()
    ctx.server = server
    ctx.url = server.url
    ctx.userDataDir = server.userDataDir
    ctx.appDataDir = server.appDataDir
  })
  afterAll(async () => {
    if (ctx.server) {
      await ctx.server.stop()
    }
  })
  return ctx
}
