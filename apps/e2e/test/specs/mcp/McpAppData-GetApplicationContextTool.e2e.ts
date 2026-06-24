import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP AppData - GetApplicationContextTool', () => {
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

  it('GetApplicationContextTool should return context fields', async () => {
    const r = await mcpClient.getAppContext(ctx.clientCwd, ctx.mcpAddress)
    expect(r).toHaveProperty('selectedMediaFolder')
    expect(r).toHaveProperty('language')
  })
})
