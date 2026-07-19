import { expect } from '@wdio/globals'
import { cleanup, setup } from 'test/lib/testbed'
import { folder1, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import MusicPanelCO from 'test/componentobjects/MusicPanel.co'
import StatusBar from 'test/componentobjects/StatusBar'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

describe('App', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
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

    it('can switch between media folders', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const traceId = this.test?.id ?? 'App.e2e.ts'

        const tvshowPath = await createAndImportFolderViaBrowser(folder1, traceId, testFolder)
        const moviePath = await createAndImportFolderViaBrowser(folder2, traceId, testFolder)
        const musicPath = await createAndImportFolderViaBrowser(
            {
                folderName: 'BilibiliMusic',
                type: 'music',
                files: ['song1.mp3', 'song2.mp4'],
            },
            traceId,
            testFolder,
        )

        await browser.pause(10000)

        await Sidebar.clickFolder(folder1.folderName)
        await browser.pause(1000)
        const tvAllTitles = Object.values(folder1.translations?.title ?? {})
        expect(tvAllTitles).toContain(await TvShowPanelCO.immersiveInput.getValue())
        expect(await StatusBar.getMessage()).toBe(tvshowPath)

        await Sidebar.clickFolder(folder2.folderName)
        await browser.pause(1000)
        const movieAllTitles = Object.values(folder2.translations?.title ?? {})
        expect(movieAllTitles).toContain(await MoviePanelCO.input.getValue())
        expect(await StatusBar.getMessage()).toBe(moviePath)

        await Sidebar.clickFolder('BilibiliMusic')
        await browser.pause(1000)
        expect(await MusicPanelCO.title.getText()).toBe('BilibiliMusic')
        expect(await StatusBar.getMessage()).toBe(musicPath)
    })
})
