import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import { setup, cleanup } from '../../lib/testbed'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EPISODE_FILE_NAME = 'S01E01.mp4'

describe('TVShow - Unlink Episode', () => {

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
        // Dismiss open episode context menu so sidebar folder stays clickable for cleanup
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(300)

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    beforeEach(() => {
        resetStepContext()
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
            expect(fs.readdirSync(folder.path)).toContain(EPISODE_FILE_NAME)
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
