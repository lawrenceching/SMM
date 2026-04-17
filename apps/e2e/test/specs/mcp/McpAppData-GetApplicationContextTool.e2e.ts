import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP AppData - GetApplicationContextTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('GetApplicationContextTool should return context fields', async () => {
    const r = await mcpClient.getAppContext(ctx.clientCwd, ctx.mcpAddress)
    expect(r).toHaveProperty('selectedMediaFolder')
    expect(r).toHaveProperty('language')
  })
})
