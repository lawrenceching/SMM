import { expect } from '@wdio/globals'
import { cleanup, setup } from '../../lib/testbed'
import { createAndImportFolder } from 'test/actions/import-folders'
import { folder1, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import MusicPanelCO from 'test/componentobjects/MusicPanel.co'
import StatusBar from 'test/componentobjects/StatusBar'

describe('App', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('can switch between media folders', async function() {

        if(env.slowdown) {
            this.timeout(60 * 1000)
        }

        const traceId = this.test?.id ?? 'TvShowPanel.e2e.ts'

        const tvshowFolder = await createAndImportFolder(folder1, traceId)
        const movieFolder = await createAndImportFolder(folder2, traceId)
        const musicFolder = await createAndImportFolder({
            folderName: "BilibiliMusic",
            type: "music",
            files: ["song1.mp3", "song2.mp4"],
        }, traceId)

        // wait for media folder initialization to complete
        await browser.pause(10000);

        await Sidebar.clickFolder(tvshowFolder.folderName)
        await browser.pause(1000); // wait for UI update
        expect(await TvShowPanelCO.immersiveInput.getValue()).toBe(tvshowFolder.translations?.title?.['en-US'] ?? 'N/A')
        expect(await StatusBar.getMessage()).toBe(tvshowFolder.path)

        await Sidebar.clickFolder(movieFolder.folderName)
        await browser.pause(1000); // wait for UI update
        expect(await MoviePanelCO.input.getValue()).toBe(movieFolder.translations?.title?.['en-US'] ?? 'N/A')
        expect(await StatusBar.getMessage()).toBe(movieFolder.path)

        await Sidebar.clickFolder(musicFolder.folderName)
        await browser.pause(1000); // wait for UI update
        expect(await MusicPanelCO.title.getText()).toBe(musicFolder.folderName)
        expect(await StatusBar.getMessage()).toBe(musicFolder.path)
    })
})
