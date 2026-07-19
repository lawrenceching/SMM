import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import { logTvShowHeaderLayoutDiagnostics } from 'test/lib/tvShowHeaderLayoutDiagnostics'

const FOLDER_NAME = 'UnKnown Folder 123123123123'

const UNRECOGNIZED_EPISODE_TABLE = `Specials
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
S01E12 - - - -`

const RECOGNIZED_EPISODE_TABLE = `Specials
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
S01E12 - - - -`

describe('TVShow - Recognize By Plan', () => {
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
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('shows AI recognize prompt, confirms plan, and applies recognition', async function () {
        this.timeout(90 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" was imported with no media files`)
        await when(`folder "${FOLDER_NAME}" was selected`)
        await then('episode table shows unrecognized episodes', async () => {
            await browser.pause(1000)
            expect(await TvShowPanelCO.toString()).toContain(UNRECOGNIZED_EPISODE_TABLE)
        })

        await when('recognize media file plan was created for S01E01..03')
        await when('I refresh the browser page')
        await when(`folder "${FOLDER_NAME}" was selected`)
        await then('AI recognize prompt is displayed')
        await logTvShowHeaderLayoutDiagnostics(
            'RecognizeByPlan/AI-plan: after prompt visible, before confirm (control — no recognize-button click)',
        )
        await when('I confirm floating prompt')

        await then('episode table reflects recognized S01E01..03', async () => {
            await browser.waitUntil(
                async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RECOGNIZED_EPISODE_TABLE)
        })
    })

    it('shows rule-based recognize prompt, confirms plan', async function () {
        this.timeout(60 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" was imported with no media files`)
        await when(`folder "${FOLDER_NAME}" was selected`)
        await then('episode table shows unrecognized episodes', async () => {
            await browser.pause(1000)
            expect(await TvShowPanelCO.toString()).toContain(UNRECOGNIZED_EPISODE_TABLE)
        })

        await logTvShowHeaderLayoutDiagnostics(
            'RecognizeByPlan/rule-based: before recognize-button click',
        )
        await when('I click "Recognize" button')
        await when('I confirm floating prompt')

        await then('episode table reflects recognized S01E01..03', async () => {
            await browser.waitUntil(
                async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RECOGNIZED_EPISODE_TABLE)
        })
    })
})
