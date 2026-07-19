import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import {
  clearFolderViaBrowser,
  createAndImportFolderViaBrowser,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

describe('MCP Other - GetEpisodesTool', () => {
  const ctx = createMcpSpecContext()
  let testFolder = ''

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

    testFolder = await resolveSmmTestFolderViaBrowser()
    await clearFolderViaBrowser(testFolder)
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
    if (testFolder) {
      await clearFolderViaBrowser(testFolder)
    }
  })

  it('GetEpisodesTool should return episodes list with mapped video path', async () => {
    const folderPath = await createAndImportFolderViaBrowser(
      folder1,
      'e2eTest:McpGetEpisodesTool',
      testFolder,
    )
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

    await browser.pause(4000)

    const r = await mcpClient.getEpisodes(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
    })

    expect(r.totalCount).toEqual(13)
    expect(r.showName).toEqual(folder1.translations?.title?.['en-US'] ?? 'N/A')
    expect(r.numberOfSeasons).toEqual(2)
  })
})
