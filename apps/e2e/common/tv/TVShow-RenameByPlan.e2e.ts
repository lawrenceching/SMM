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
import { folder1 } from 'test/actions/import-folders'

import { testbedOs } from 'test/lib/e2e-platform'

const RENAMED_EPISODE_TABLE = `Specials
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
S01E12 - - - -`

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('TVShow - Rename By Plan', () => {
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

    it('Rename by AI and then rename by rule', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with three episodes was imported and recognized')
        await when(`folder "${folder1.folderName}" was selected`)
        await logTvShowHeaderLayoutDiagnostics(
            'RenameByPlan: before rename-button click',
        )
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I click "Confirm" on rename prompt')
        await then('episode table shows renamed Plex-style paths', async () => {
            await browser.waitUntil(
                async () =>
                    (await TvShowPanelCO.toString()).includes(
                        'Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
                    ),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RENAMED_EPISODE_TABLE)
        })
    })
})
