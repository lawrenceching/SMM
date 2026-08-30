import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import Prompts from 'test/componentobjects/Prompts'
import { folder1 } from 'test/actions/import-folders'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs } from 'test/lib/e2e-platform'

const RENAMED_PLEX_EPISODE_TABLE = `Specials
S00E01 - - - -
Season 1
S01E01 Season 01/WATATEN an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv V V V
S01E02 Season 01/WATATEN an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv V V V
S01E03 Season 01/WATATEN an Angel Flew Down to Me - S01E03 - Imprinting.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`

const RENAMED_EMBY_EPISODE_TABLE = `Specials
S00E01 - - - -
Season 1
S01E01 Season 1/WATATEN an Angel Flew Down to Me S1E1 A Funny, Squirmy Feeling.mkv V V V
S01E02 Season 1/WATATEN an Angel Flew Down to Me S1E2 Incontestably Cute.mkv V V V
S01E03 Season 1/WATATEN an Angel Flew Down to Me S1E3 Imprinting.mkv V V V
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
describe('TVShow - Rename', () => {
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

    it('rename button is disabled when TV show folder is not recognized', async function () {
        this.timeout(60 * 1000)

        await given('TV show folder "UnKnown Folder 123123123123" was imported')
        await when('folder "UnKnown Folder 123123123123" was selected')
        await then('"Rename" button is disabled')
    })

    it('UC1: confirm rename applies default Plex naming rule', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with three episodes was imported and recognized')
        await when(`folder "${folder1.folderName}" was selected`)
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I click "Confirm" on rename prompt')
        await then('episode table shows renamed Plex-style paths', async () => {
            await browser.waitUntil(
                async () =>
                    (await TvShowPanelCO.toString()).includes(
                        'Season 01/WATATEN an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
                    ),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RENAMED_PLEX_EPISODE_TABLE)
        })
    })

    it('UC2: switch naming rule regenerates preview then apply Emby names', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with three episodes was imported and recognized')
        await when(`folder "${folder1.folderName}" was selected`)
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I select naming rule "emby" on rename prompt')
        await then('"Rename" prompt shows Emby-style preview paths')
        await when('I click "Confirm" on rename prompt')
        await then('episode table shows renamed Emby-style paths', async () => {
            await browser.waitUntil(
                async () =>
                    (await TvShowPanelCO.toString()).includes(
                        'Season 1/WATATEN an Angel Flew Down to Me S1E1 A Funny, Squirmy Feeling.mkv',
                    ),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RENAMED_EMBY_EPISODE_TABLE)
        })
    })

    it('cancel rename dialog — prompt closes and files remain unchanged (S2)', async function () {
        this.timeout(60 * 1000)

        await given('TV show folder "CancelTest 123123" was recognized')
        await when('folder "CancelTest 123123" was selected')
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I click "Cancel" on rename prompt')
        await then('"Rename" prompt is closed')

        const tableText = await TvShowPanelCO.toString()
        expect(tableText).not.toContain('Season 01')
        expect(tableText).toContain('S01E01')
    })

    it('rename confirm is disabled when all files already match naming rule (S5)', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder "AllMatchTest" was recognized')
        await when('folder "AllMatchTest" was selected')

        // First rename — actually rename files to Plex format
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I click "Confirm" on rename prompt')

        await browser.waitUntil(
            async () => (await TvShowPanelCO.toString()).includes('Season 01'),
            { timeout: 15000, interval: 500 },
        )

        // Second rename — all files already match, confirm should be disabled
        await when('I click "Rename" button')

        // Prompt is open but no preview paths (all files already match)
        await then('"Rename" prompt is open with no files to rename', async () => {
            await Prompts.cancelButton.waitForDisplayed({ timeout: 10000 })
            const previewPaths = await TvShowPanelCO.newVideoFilePaths
            expect(previewPaths.length).toBe(0)
        })

        // Confirm button should be disabled since nothing to apply
        await then('"Rename" confirm button is disabled')
    })
})
