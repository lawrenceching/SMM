import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import { cleanup, setup } from 'test/lib/testbed'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

describe('MCP Prompts - HowToRecognizeEpisodeVideoFilesTool', () => {
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

  it('HowToRecognizeEpisodeVideoFilesTool should return guideline markdown', async () => {
    const r = await mcpClient.howToRecognizeEpisodeVideoFiles(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(r.text).toContain('begin-recognize-task')
  })
})
