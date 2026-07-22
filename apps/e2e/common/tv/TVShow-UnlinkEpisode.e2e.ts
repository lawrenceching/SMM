import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    listFileNamesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'

import { testbedOs } from 'test/lib/e2e-platform'

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EPISODE_FILE_NAME = 'S01E01.mp4'

/**
 * @supports local, Electron, HarmonyOS
 */
describe('TVShow - Unlink Episode', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        // Dismiss open episode context menu so sidebar folder stays clickable for cleanup
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(300)

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('unlinks the video file from the episode via context menu', async function () {
        this.timeout(90 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" with files "${EPISODE_FILE_NAME}" was imported via menu`)
        await when('TV show panel is ready with TMDB data')
        await then('episode "S01E01" is linked to a video file')
        await when('I click "Unlink" from episode "S01E01" context menu')
        await browser.pause(1000)
        await then('episode "S01E01" is not linked to a video file')
        await then('video file still exists on disk', async () => {
            const folder = getStepContext()._folder as { path: string }
            expect(await listFileNamesViaBrowser(folder.path)).toContain(EPISODE_FILE_NAME)
        })
    })

    it('disables Unlink menu item when episode has no linked video file', async function () {
        this.timeout(90 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" with files "" was imported via menu`)
        await when('TV show panel is ready with TMDB data')
        await then('episode "S01E01" is not linked to a video file')
        await when('I open context menu for episode without linked file', async () => {
            await TvShowPanelCO.openContextMenuForEpisode('S01E01')
            await browser.pause(300)
        })
        await then('"Unlink" episode context menu item is disabled')
    })
})
