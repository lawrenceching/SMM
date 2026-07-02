import { expect, browser } from '@wdio/globals'
import { Path } from '@smm/core'
import {
  cleanup,
  expectMediaMetadataToBe,
  importFolderWithMediaMetadata,
  setup,
} from '../../lib/testbed'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'
import Prompts from 'test/componentobjects/Prompts'

describe('TVShow - Rule Based Recognize', () => {
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

  it('rule-based recognize: click recognize, confirm, then verify UI and on-disk metadata', async function () {
    this.timeout(60 * 1000)

    // Step 1: Open page and import a tvshow folder.
    // Override the folder name to a value the app cannot auto-recognize,
    // then clear mediaFiles so the rule-based recognize button has work to do.
    const folder = createFolderInTestFolder({
      ...folder1,
      folderName: 'UnKnown Folder 123123123123',
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
      mediaMetadata.mediaFiles = []
      return mediaMetadata
    })

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
    await Sidebar.clickFolder(folder.folderName)
    await browser.pause(1000)

    // Sanity: with mediaFiles=[] the table should show no recognized video files yet.
    expect(await TvShowPanelCO.toString()).toContain(`S01E01 - - - -`)

    // Step 2: Click the rule-based recognize button.
    await TvShowPanelCO.recognizeButton.waitForClickable({ timeout: 10000 })
    await TvShowPanelCO.recognizeButton.click()

    // Step 3: The floating prompt appears; click confirm to apply the plan.
    await Prompts.confirmButton.waitForDisplayed({ timeout: 10000 })
    await Prompts.confirmButton.waitForClickable({ timeout: 10000 })
    await Prompts.confirmButton.click()

    // Step 4: Verify the UI reflects the recognized episodes.
    await browser.waitUntil(
      async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
      { timeout: 15000, interval: 500 },
    )
    expect(await TvShowPanelCO.toString()).toContain(`S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V`)

    // Step 5: Verify the metadata file is correctly persisted on disk.
    // The rule-based recognizer should assign each .mkv to the matching season+episode.
    const folderPathPosix = Path.posix(folder.path!)
    await expectMediaMetadataToBe(folder.path!, (json) => {
      const mediaFiles = json?.mediaFiles
      if (!Array.isArray(mediaFiles) || mediaFiles.length !== 3) {
        return false
      }
      const expected = [
        { season: 1, episode: 1, file: 'S01E01.mkv' },
        { season: 1, episode: 2, file: 'S01E02.mkv' },
        { season: 1, episode: 3, file: 'S01E03.mkv' },
      ]
      return expected.every((e) =>
        mediaFiles.some(
          (mf: { seasonNumber?: number; episodeNumber?: number; absolutePath?: string }) =>
            mf.seasonNumber === e.season &&
            mf.episodeNumber === e.episode &&
            typeof mf.absolutePath === 'string' &&
            mf.absolutePath === `${folderPathPosix}/${e.file}`,
        ),
      )
    })
  })
})
