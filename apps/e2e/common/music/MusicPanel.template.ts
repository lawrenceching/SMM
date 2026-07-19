import { cleanup, setup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

/**
 * Template for MusicPanel e2e specs (common: browser / Electron / HarmonyOS).
 * Copy and adapt; use createAndImportFolderViaBrowser for fixtures.
 */
describe('MusicPanel Template', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
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
            clearLocalStorage: true,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Test Name', async function () {
        this.timeout(60000)

        await createAndImportFolderViaBrowser({
            folderName: 'BilibiliMusic',
            type: 'music',
            files: [],
        }, 'Test Name')

        // TODO: do test

        // TODO: assert result
    })
})
