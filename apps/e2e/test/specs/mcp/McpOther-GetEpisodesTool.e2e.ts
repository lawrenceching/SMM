import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Other - GetEpisodesTool', () => {
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

  it('GetEpisodesTool should return episodes list with mapped video path', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpGetEpisodesTool')
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

    // need to wait for media metadata to be saved in disk
    await browser.pause(4000);

    const r = await mcpClient.getEpisodes(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })

    expect(r.totalCount).toEqual(13)
    expect(r.showName).toEqual(folder1.translations?.title?.['en-US'] ?? 'N/A')
    expect(r.numberOfSeasons).toEqual(2)
  })
})
