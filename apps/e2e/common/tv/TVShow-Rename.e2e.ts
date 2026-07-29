import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import Prompts from 'test/componentobjects/Prompts'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs } from 'test/lib/e2e-platform'

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
