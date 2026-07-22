import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * @supports local, Electron
 * @unsupported HarmonyOS
 */
describe('MCP Prompts - HowToRenameEpisodeVideoFilesTool', () => {
  const ctx = createMcpSpecContext()

  before(function () {
    skipIfOhos(this)
  })

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
      os: testbedOs,
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
      os: testbedOs,
    })
  })

  it('HowToRenameEpisodeVideoFilesTool should return guideline markdown', async () => {
    const r = await mcpClient.howToRenameEpisodeVideoFiles(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.text).toContain('begin-rename-episode-video-file-task')
  })
})
