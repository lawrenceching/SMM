import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { setup, cleanup, importFolderWithMediaMetadata } from '../../lib/testbed'
import { Path } from '@smm/core'
import { hello } from '@smm/test'
import {createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'
import Prompts from 'test/componentobjects/Prompts'
import type { RenameFilesPlan } from '@smm/core/types/RenameFilesPlan'

describe('TVShow - Rename By Plan', () => {
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

  it('Rename by AI and then rename by rule', async function () {
    this.timeout(90 * 1000)

    /**
     * Maximize window to avoid recognize button is folded in "More" menu and not visible
     */
    await browser.maximizeWindow();

    const folder = createFolderInTestFolder({
      ...folder1,
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')

    await browser.pause(60 * 1000)

    //  disable for debugging
//     await page.open()
//     await Sidebar.waitForFolderName(folder.folderName, 1000)
//     await Sidebar.clickFolder(folder.folderName)

//     await browser.pause(1000)
//     expect(await TvShowPanelCO.toString()).toContain(`Specials
// S00E01 - - - -
// Season 1
// S01E01 S01E01.mkv V V V
// S01E02 S01E02.mkv V V V
// S01E03 S01E03.mkv V V V
// S01E04 - - - -
// S01E05 - - - -
// S01E06 - - - -
// S01E07 - - - -
// S01E08 - - - -
// S01E09 - - - -
// S01E10 - - - -
// S01E11 - - - -
// S01E12 - - - -`)


//     // 2. Create recognize file plan (POSIX paths; files map S01E01.mkv -> (1,1), S01E02.mkv -> (1,2))
//     const { userDataDir } = await hello()
//     const plansDir = path.join(userDataDir, 'plans')
//     fs.mkdirSync(plansDir, { recursive: true })

//     const taskId = crypto.randomUUID()
//     const planId = crypto.randomUUID()
//     const mediaFolderPathPosix = Path.posix(folder.path!)

//     const plan: RenameFilesPlan = {
//       id: planId,
//       task: 'rename-files',
//       status: 'pending',
//       mediaFolderPath: mediaFolderPathPosix,
//       files: [
//         { from: mediaFolderPathPosix + '/S01E01.mkv', to: mediaFolderPathPosix + '/S01E01 - [1080P].mkv' },
//         { from: mediaFolderPathPosix + '/S01E02.mkv', to: mediaFolderPathPosix + '/S01E02 - [1080P].mkv' },
//         { from: mediaFolderPathPosix + '/S01E03.mkv', to: mediaFolderPathPosix + '/S01E03 - [1080P].mkv' },
//       ],
//     }

//     planFilePath = path.join(plansDir, taskId + '.plan.json')
//     fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8')
//     console.log('Created recognize plan:', planFilePath)

//     await browser.refresh()

//     await Sidebar.waitForFolderName(folder.folderName, 1000)
//     await Sidebar.clickFolder(folder.folderName)

//     await Prompts.confirmButton.waitForDisplayed()
//     await Prompts.confirmButton.click()

//     await browser.pause(1000)
//     expect(await TvShowPanelCO.toString()).toContain(`Specials
// S00E01 - - - -
// Season 1
// S01E01 S01E01 - [1080P].mkv V V V
// S01E02 S01E02 - [1080P].mkv V V V
// S01E03 S01E03 - [1080P].mkv V V V
// S01E04 - - - -
// S01E05 - - - -
// S01E06 - - - -
// S01E07 - - - -
// S01E08 - - - -
// S01E09 - - - -
// S01E10 - - - -
// S01E11 - - - -
// S01E12 - - - -`)

//      await TvShowPanelCO.renameButton.click()
//      await Prompts.confirmButton.waitForDisplayed()
//      await Prompts.confirmButton.click()

//      await browser.pause(1000)
//     expect(await TvShowPanelCO.toString()).toContain(`Specials
// S00E01 - - - -
// Season 1
// S01E01 Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv V V V
// S01E02 Season 01/WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv V V V
// S01E03 Season 01/WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv V V V
// S01E04 - - - -
// S01E05 - - - -
// S01E06 - - - -
// S01E07 - - - -
// S01E08 - - - -
// S01E09 - - - -
// S01E10 - - - -
// S01E11 - - - -
// S01E12 - - - -`)
  })

  
})
