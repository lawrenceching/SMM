import { createAndImportFolder } from "test/actions/import-folders"
import { cleanup, setup } from "test/lib/testbed"

describe('MusicPanel Template', () => {

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
    })

    it('Test Name', async function() {
        this.timeout(60000);

        const folder = await createAndImportFolder({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "Test Name")

        // TODO: do test

        // TODO: assert result

    })

})
