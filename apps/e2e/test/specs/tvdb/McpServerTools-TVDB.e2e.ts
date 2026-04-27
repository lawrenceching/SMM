import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanup, importFolderWithMediaMetadata, setup } from '../../lib/testbed'
import mcpClient from '../../lib/McpClient'
import { createFolderInTestFolder, folder3 } from '../../actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { enableMcpFromStatusBarAndStoreAddress, getMcpAddressForWorker } from '../../lib/mcpSpecShared'

describe('MCP Server Tools - TVDB', () => {
  before(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: (config) => {
        config.enableMcpServer = true
        return config
      },
      openBrowserPage: true,
    })

    // App start MCP server after it detected user config changed
    // It may need a while for MCP server to start
    await browser.pause(5000)
    await enableMcpFromStatusBarAndStoreAddress()
  })

  const repoRoot = path.resolve(process.cwd(), '..', '..')
  const clientCwd = path.resolve(repoRoot, 'test/mcp-test-client')

  afterEach(async () => {
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: (config) => {
        config.enableMcpServer = true
        return config
      },
    });

    await browser.refresh();
    await StatusBar.appVersion.waitForDisplayed();
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

    await Sidebar.waitForFolderName(folder.folderName, 5000)
    await Sidebar.clickFolder(folder.folderName)
    
    await browser.pause(1000)
    
    const r = await mcpClient.getMediaMetadata(clientCwd, getMcpAddressForWorker(), {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)
    
  })

})
