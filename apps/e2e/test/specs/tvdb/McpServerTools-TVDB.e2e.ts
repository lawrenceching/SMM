import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanup, createBeforeHook } from '../../lib/testbed'
import mcpClient from '../../lib/McpClient'
import { delay } from 'es-toolkit'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { createAndImportFolder, folder3 } from '../../actions/import-folders'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
import Menu from 'test/componentobjects/Menu'
import env from 'test/lib/env'

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
    await (createBeforeHook()());

    await Menu.openConfigDialog()
    await ConfigDialog.waitForDisplayed()
    await ConfigDialog.clickTab('general')

    await ConfigDialog.setPrimaryDatabase('TVDB')
    await ConfigDialog.clickSave()
    await ConfigDialog.pressEscape()
    await browser.pause(200)
    await ConfigDialog.pressEscape()
    await ConfigDialog.waitForClosed()


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
    });

    await browser.refresh();
    await StatusBar.appVersion.waitForDisplayed();
  }) 

  it('GetMediaMetadataTool should return cached metadata for folder', async function () {
    if(env.slowdown) {
      this.timeout(10 * 60 * 1000)
    }
    const folder = await createAndImportFolder(folder3, 'e2eTest:GetMediaMetadataTool')
    
    await TVShowPanel.searchbox.input.waitForDisplayed()
    const initialInputValue = await TVShowPanel.searchbox.input.getValue()
    expect(initialInputValue).toBe('')
    await browser.pause(1000)
    
    await TVShowPanel.searchbox.input.click()
    
    await browser.pause(300)

    await TVShowPanel.searchbox.database.waitForDisplayed();
    if(env.slowdown) {
      await browser.pause(1000)
    }
    await TVShowPanel.searchbox.setDatabase('TVDB')
    if(env.slowdown) {
      await browser.pause(1000)
    }
    await TVShowPanel.searchbox.setLanguage('简体中文')
    await browser.pause(300)

    await TVShowPanel.searchbox.input.click()
    await browser.pause(300)

    /**
     * Anime 我推的孩子 have 4 seasons in TVDB
     * while 2 seasons in TMDB
     * So it's a good example to verify SMM search TVDB database
     */
    const keyword = '我推的孩子'
    await TVShowPanel.searchbox.input.setValue(keyword)
    if(env.slowdown) {
      await browser.pause(1000)
    }
    await TVShowPanel.searchbox.searchButton.click()

    await browser.pause(1000)

    console.log(`Searching TV show using keyword: ${keyword}`)
    await TVShowPanel.searchbox.selectSearchResultByText('【我推的孩子】')

    await browser.pause(5000)

    const r = await mcpClient.getMediaMetadata(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain('tvShow')
    expect(r.data.tvShow).toBeDefined()
    expect(typeof r.data.tvShow).toBe('object')
    expect(r.data.tvShow).not.toBe(null)
    if (typeof r.data.tvShow === 'object' && r.data.tvShow !== null) {
      expect(r.data.tvShow.source).toBe('TVDB')
      expect(typeof r.data.tvShow.id).toBe('number')
    }

    const ep = await mcpClient.getEpisodes(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    expect(ep.episodes.length).toBeGreaterThan(0)
    expect(ep.totalCount).toBe(ep.episodes.length)
    expect(ep.showName.length).toBeGreaterThan(0)
    expect(ep.numberOfSeasons).toBeGreaterThan(0)

    const getEpisodeResponse = await mcpClient.getEpisode(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
      season: 3,
      episode: 1,
    })

    expect(getEpisodeResponse.videoFilePath).toContain('')
    expect(getEpisodeResponse.season).toBe(3)
    expect(getEpisodeResponse.episode).toBe(1)
    expect(getEpisodeResponse.message).toBe('No media files found in the media folder metadata.')
  })

})
