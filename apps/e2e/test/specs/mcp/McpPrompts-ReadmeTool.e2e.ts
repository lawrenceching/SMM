import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Prompts - ReadmeTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('ReadmeTool should return README markdown', async () => {
    const r = await mcpClient.readme(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('Simple Media Manager (SMM)')
    expect(r.text).toContain('## 核心概念')
  })
})
