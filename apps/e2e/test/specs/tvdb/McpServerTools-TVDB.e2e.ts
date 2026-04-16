import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanup, importFolderWithMediaMetadata, setup } from '../../lib/testbed'
import mcpClient from '../../lib/McpClient'
import { delay } from 'es-toolkit'
import { createFolderInTestFolder, folder3 } from '../../actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'

async function ensureMcpPopoverOpen(): Promise<void> {
  const isOpen = await StatusBar.isMcpPopoverOpen()
  if (!isOpen) {
    await StatusBar.clickMcpToggle()
  }
  const opened = await StatusBar.waitForMcpPopover(5000)
  expect(opened).toBe(true)
}

describe('MCP Server Tools - TVDB', () => {
  before(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: true,
      openBrowserPage: true,
    })

    await ensureMcpPopoverOpen();

    await StatusBar.mcpSwitch.waitForDisplayed();

    if(!await StatusBar.isMcpToggleOn()) {
      console.log(`MCP server is not enabled, enabling it...`)
      await StatusBar.mcpSwitch.waitForClickable();

      // waitForClickable didn't work, have to wait
      await delay(500)
    
      await StatusBar.mcpSwitch.click();
      await delay(1000)
    } else {
      console.log(`MCP server is already enabled`)
    }

    mcpAddress = await StatusBar.getMcpAddress()
    expect(mcpAddress).toContain('http://')
  })

  after(async () => {
    await ensureMcpPopoverOpen();
    await StatusBar.mcpSwitch.waitForDisplayed();

    if(await StatusBar.isMcpToggleOn()) {
      await StatusBar.mcpSwitch.click();
      await delay(1000)
    }
  })

  const repoRoot = path.resolve(process.cwd(), '..', '..')
  const clientCwd = path.resolve(repoRoot, 'test/mcp-test-client')
  let mcpAddress = ''

  afterEach(async () => {
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
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
    
    const r = await mcpClient.getMediaMetadata(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)
    
  })

})
