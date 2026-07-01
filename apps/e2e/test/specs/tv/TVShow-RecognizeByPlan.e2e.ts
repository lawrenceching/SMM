import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { setup, cleanup, importFolderWithMediaMetadata } from '../../lib/testbed'
import { Path } from '@smm/core'
import { getPlanDir } from '@smm/test'
import type { RecognizeMediaFilePlan } from '@smm/core/types/RecognizeMediaFilePlan.ts'
import {createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'
import Prompts from 'test/componentobjects/Prompts'
import { logTvShowHeaderLayoutDiagnostics } from '../../lib/tvShowHeaderLayoutDiagnostics'

describe('TVShow - Recognize By Plan', () => {
  let planFilePath: string | null = null

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

  it('shows AI recognize prompt, confirms plan, and applies recognition (plan no longer pending)', async function () {
    this.timeout(90 * 1000)

    const folder = createFolderInTestFolder({
      ...folder1,
      folderName: "UnKnown Folder 123123123123",
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
      mediaMetadata.mediaFiles = []
      return mediaMetadata
    })

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 5000)
    await Sidebar.clickFolder(folder.folderName)

    await browser.pause(1000)
    expect(await TvShowPanelCO.toString()).toContain(`Specials
S00E01 - - - -
Season 1
S01E01 - - - -
S01E02 - - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)


    // 2. Create recognize file plan (POSIX paths; files map S01E01.mkv -> (1,1), S01E02.mkv -> (1,2))
    const plansDir = await getPlanDir()
    fs.mkdirSync(plansDir, { recursive: true })

    const planId = crypto.randomUUID()
    const mediaFolderPathPosix = Path.posix(folder.path!)

    const plan: RecognizeMediaFilePlan = {
      id: planId,
      task: 'recognize-media-file',
      status: 'pending',
      creator: 'ai',
      mediaFolderPath: mediaFolderPathPosix,
      files: [
        { season: 1, episode: 1, path: mediaFolderPathPosix + '/S01E01.mkv' },
        { season: 1, episode: 2, path: mediaFolderPathPosix + '/S01E02.mkv' },
        { season: 1, episode: 3, path: mediaFolderPathPosix + '/S01E03.mkv' },
      ],
    }

    planFilePath = path.join(plansDir, planId + '.plan.json')
    fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8')
    console.log('Created recognize plan:', planFilePath)

    await browser.refresh()

    await Sidebar.waitForFolderName(folder.folderName, 10000)
    await Sidebar.clickFolder(folder.folderName)

    await Prompts.aiBasedRecognizePrompt.waitForDisplayed({ timeout: 10000 })
    await logTvShowHeaderLayoutDiagnostics(
      'RecognizeByPlan/AI-plan: after prompt visible, before confirm (control — no recognize-button click)',
    )
    await Prompts.confirmButton.waitForClickable({ timeout: 10000 })
    await Prompts.confirmButton.click()

    await browser.waitUntil(
      async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
      { timeout: 15000, interval: 500 },
    )
    expect(await TvShowPanelCO.toString()).toContain(`Specials
S00E01 - - - -
Season 1
S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V
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

  it('shows rule-based recognize prompt, confirms plan', async function () {
    this.timeout(1 * 60 * 1000)

    const folder = createFolderInTestFolder({
      ...folder1,
      folderName: "UnKnown Folder 123123123123",
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
      mediaMetadata.mediaFiles = []
      return mediaMetadata
    })

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 1000)
    await Sidebar.clickFolder(folder.folderName)

    await browser.pause(1000)
    expect(await TvShowPanelCO.toString()).toContain(`Specials
S00E01 - - - -
Season 1
S01E01 - - - -
S01E02 - - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)


    await logTvShowHeaderLayoutDiagnostics(
      'RecognizeByPlan/rule-based: before recognize-button click',
    )
    await TvShowPanelCO.recognizeButton.click()
    await Prompts.confirmButton.waitForDisplayed({ timeout: 10000 })
    await Prompts.confirmButton.waitForClickable({ timeout: 10000 })
    await Prompts.confirmButton.click()

    await browser.waitUntil(
      async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
      { timeout: 15000, interval: 500 },
    )
    expect(await TvShowPanelCO.toString()).toContain(`Specials
S00E01 - - - -
Season 1
S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V
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
