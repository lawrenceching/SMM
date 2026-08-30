import { afterAll, beforeAll } from 'bun:test'
import { startMcpServer, type McpServerHandle } from './mcpServer'
import { writeUserConfig } from './testSetup'

export interface McpTestContext {
  server: McpServerHandle
  url: string
  userDataDir: string
  appDataDir: string
}

/**
 * Start an isolated MCP server and reset its user config (folders: []).
 * Call from `beforeAll`; the returned context is mutated in place.
 */
export async function setupMcpServer(ctx: McpTestContext): Promise<void> {
  const server = await startMcpServer()
  ctx.server = server
  ctx.url = server.url
  ctx.userDataDir = server.userDataDir
  ctx.appDataDir = server.appDataDir
  await writeUserConfig(server.userDataDir, { folders: [] })
}

/** Stop the server started by {@link setupMcpServer}. */
export async function teardownMcpServer(ctx: McpTestContext): Promise<void> {
  if (ctx.server) {
    await ctx.server.stop()
  }
}

/**
 * Register `beforeAll`/`afterAll` hooks that start an isolated MCP server
 * with a reset config and tear it down afterwards. Returns a context object
 * populated with the server URL / dirs once hooks run.
 */
export function useMcpServer(): McpTestContext {
  const ctx: McpTestContext = {
    server: undefined as unknown as McpServerHandle,
    url: '',
    userDataDir: '',
    appDataDir: '',
  }
  beforeAll(async () => {
    await setupMcpServer(ctx)
  })
  afterAll(async () => {
    await teardownMcpServer(ctx)
  })
  return ctx
}
