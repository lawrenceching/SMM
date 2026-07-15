import { expect, browser } from '@wdio/globals'
import { cleanup, importFolderWithMediaMetadata, setup } from '../../lib/testbed'
import mcpClient from '../../lib/McpClient'
import { createFolderInTestFolder, folder3 } from '../../actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Server Tools - TVDB', () => {
  const ctx = createMcpSpecContext()

  beforeEach(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: true,
      openBrowserPage: true,
    })
    await setupMcpTest()
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: false,
    })
  })

  it('GetMediaMetadataTool should return cached metadata for folder', async function () {

    const folder = createFolderInTestFolder({
      ...folder3,
      folderName: '我推的孩子 {tvdbid=421069}'
    })

    await importFolderWithMediaMetadata(folder, '我推的孩子.metadata.json', (mediaMetadata) => {
      mediaMetadata.mediaFiles = []
      return mediaMetadata
    })

    await browser.refresh();
    await StatusBar.appVersion.waitForDisplayed();

    await Sidebar.waitForFolderName(folder.folderName, 30000)
    await Sidebar.clickFolder(folder.folderName)

    await browser.pause(1000)

    console.log(`[TVDB-e2e] calling getMediaMetadata with mcpAddress=${ctx.mcpAddress}`)

    const r = await mcpClient.getMediaMetadata(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)

  })

})

