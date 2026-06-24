import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Prompts - ReadmeTool', () => {
  const ctx = createMcpSpecContext()

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
    })
    await setupMcpTest()
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
    })
  })

  it('ReadmeTool should return README markdown', async () => {
    const r = await mcpClient.readme(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('Simple Media Manager (SMM)')
    expect(r.text).toContain('## 核心概念')
  })
})
