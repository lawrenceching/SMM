import { expect } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import Sidebar from 'test/componentobjects/Sidebar'
import { then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'
import { folder1 } from 'test/actions/import-folders'

/** Expected panel after folder1 ({tmdbid=84666}) init — matches InitializeTvShowByTmdb. */
const EXPECTED_EPISODE_TABLE = `Specials
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

/**
 * Import an on-device TV show folder via HarmonyOS.
 * folder1 embeds {tmdbid=84666}; recognition should populate TvShowPanel episodes.
 * Fixture root: {@link resolveSmmTestFolderViaBrowser} (app temp, not Download/).
 */
describe('TVShow - Import (HarmonyOS)', () => {
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
            os: 'HarmonyOS',
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
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
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Import TV show folder with tmdbid and show recognized episodes', async function () {
        this.timeout(6 * 60 * 1000)

        const folder = {
            ...folder1,
        }

        const folderPathInOhos = joinPlatformPath(testFolder, folder.folderName)

        await then('Create folder in HarmonyOS', {
            base: testFolder,
            folder: folder,
        })

        await then(`Import folder "${folderPathInOhos}" in HarmonyOS`)

        await then('folder name is displayed in sidebar', async () => {
            await Sidebar.waitForFolderName(folder.folderName, 60000)
        })

        await then('TvShowPanel shows recognized S01E01..03 episode rows', async () => {
            await TvShowPanelCO.waitFor(
                (state) => state.includes('S01E01 S01E01.mkv V V V'),
                120000,
                500,
            )
            expect(await TvShowPanelCO.toString()).toBe(EXPECTED_EPISODE_TABLE)
        })
    })
})
