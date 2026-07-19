import { expect } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import Sidebar from 'test/componentobjects/Sidebar'
import { then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

/**
 * Import an on-device TV show folder via HarmonyOS.
 * When online TMDB recognition fails (common on device network), the folder stays
 * unknown: sidebar shows the folder name and TvShowPanel lists folder files only.
 */
describe('TVShow - Import (HarmonyOS)', () => {
    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
            os: 'HarmonyOS',
        })
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: 'HarmonyOS',
        })
    })

    it('Import TV show folder and initialize as unknown TV show folder', async function () {
        this.timeout(6 * 60 * 1000)

        const folderName = '古见同学有交流障碍症'
        const folderPathInOhos = `/storage/Users/currentUser/Download/Anime/${folderName}`
        await then(`Import folder "${folderPathInOhos}" in HarmonyOS`)

        await then('folder name is displayed in sidebar', async () => {
            await Sidebar.waitForFolderName(folderName, 60000)
        })

        // Unknown TV show: no season/episode rows — only folder-level files.
        await then('TvShowPanel shows folder files only', async () => {
            await TvShowPanelCO.waitFor(
                (state) =>
                    state.includes('fanart') &&
                    state.includes('poster') &&
                    state.includes('nfo') &&
                    !state.includes('S01E'),
                60000,
                500,
            )
            expect(await TvShowPanelCO.toString()).toBe(`fanart
poster
nfo`)
        })
    })
})
