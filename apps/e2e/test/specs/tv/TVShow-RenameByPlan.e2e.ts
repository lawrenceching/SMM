import { expect, browser } from '@wdio/globals'
import { setup, cleanup, importFolderWithMediaMetadata } from '../../lib/testbed'
import {createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import Sidebar from 'test/componentobjects/Sidebar'
import page from 'test/pageobjects/page'
import { logTvShowHeaderLayoutDiagnostics } from '../../lib/tvShowHeaderLayoutDiagnostics'

describe('TVShow - Rename By Plan', () => {

  before(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: true,
      openBrowserPage: true,
    })
  })

  afterEach(async () => {
    await cleanup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: true,
    })
  })
  
  it('Rename by AI and then rename by rule', async function () {
    this.timeout(90 * 1000)

    const folder = createFolderInTestFolder({
      ...folder1,
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
    await Sidebar.clickFolder(folder.folderName)
    await TvShowPanelCO.waitForTable(30000)

    await logTvShowHeaderLayoutDiagnostics(
      'RenameByPlan: before rename-button click',
    )
    await TvShowPanelCO.renameButton.waitForClickable({ timeout: 10000 })
    await TvShowPanelCO.renameButton.click()

    await browser.waitUntil(
      async () => (await TvShowPanelCO.newVideoFilePaths).length === 3,
      { timeout: 30000, interval: 500, timeoutMsg: 'Expected 3 rename preview paths in episode table' },
    )

    expect((await TvShowPanelCO.newVideoFilePaths).length).toBe(3)

    const newVideoFilePaths = await TvShowPanelCO.newVideoFilePaths.map(i => i.getText())
    expect(newVideoFilePaths).toEqual([
      'Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
      'Season 01/WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv',
      'Season 01/WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv',
    ])

    await TvShowPanelCO.confirmButton.waitForClickable({ timeout: 10000 })
    await TvShowPanelCO.confirmButton.click()

    await browser.waitUntil(
      async () =>
        (await TvShowPanelCO.toString()).includes(
          'Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
        ),
      { timeout: 15000, interval: 500 },
    )

    expect(await TvShowPanelCO.toString()).toContain(`Specials
S00E01 - - - -
Season 1
S01E01 Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv V V V
S01E02 Season 01/WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv V V V
S01E03 Season 01/WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)
  })

  
})
