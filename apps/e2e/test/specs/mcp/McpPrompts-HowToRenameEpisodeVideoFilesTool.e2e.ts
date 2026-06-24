import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Prompts - HowToRenameEpisodeVideoFilesTool', () => {
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

  it('HowToRenameEpisodeVideoFilesTool should return guideline markdown', async () => {
    const r = await mcpClient.howToRenameEpisodeVideoFiles(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.text).toContain('begin-rename-episode-video-file-task')
  })
})
