import { expect } from '@wdio/globals'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, type TestFolder, folder4, folder1 } from '../../actions/import-folders'
import { setup } from '../../lib/testbed'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
import Menu from 'test/componentobjects/Menu'

describe('TVDB TV Show Media Folder Initialization', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        await Menu.openConfigDialog()
        if(env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.waitForDisplayed()
        if(env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPrimaryDatabase('TVDB')
        console.log(`set primary database to TVDB in ConfigDialog`)
        if(env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPreferMediaLanguage('zh-CN')
        console.log(`set prefer media language to zh-CN in ConfigDialog`)
        if(env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(1000)
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

    it('import media folder with tvdbid in folder name', async function() {

        if(env.slowdown) {
            this.timeout(60 * 1000)
        }
        
        const folder = await createAndImportFolder(folder4, 'TVDB TV Show Media Folder Initialization:import media folder with tvdbid in folder name');

        await delay(30 * 1000)

        expect(await TvShowPanelCO.immersiveInput.getValue()).toBe('【我推的孩子】')

        const state = await TvShowPanelCO.toString()

        // folder4 - 我推的孩子 organized as 2 seasons in TMDB while 4 seasons in TVDB
        // So below assertion proved the media folder was initialized using data from TVDB
        expect(state).toContain(`Season 0
S00E01 - - - -
S00E02 - - - -
Season 1
S01E01 S01E01.mkv - - -
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
Season 2
S02E01 - - - -
S02E02 - - - -
S02E03 - - - -
S02E04 - - - -
S02E05 - - - -
S02E06 - - - -
S02E07 - - - -
S02E08 - - - -
S02E09 - - - -
S02E10 - - - -
S02E11 - - - -
S02E12 - - - -
S02E13 - - - -
Season 3
S03E01 - - - -
S03E02 - - - -
S03E03 - - - -
S03E04 - - - -
S03E05 - - - -
S03E06 - - - -
S03E07 - - - -
S03E08 - - - -
S03E09 - - - -
S03E10 - - - -
S03E11 - - - -
Season 4
S04E01 - - - -`)

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.tvShow).toBeDefined()
            expect(mm.tvShow?.id).toBe('421069')
            expect(mm.tvShow?.name).toBe('【我推的孩子】')
            expect(mm.tvShow?.database).toBe('TVDB')
            return true;
        })

    })

    it('import media folder by searching folder name in TVDB', async function() {
        if(env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder({
            ...folder1,
            folderName: '天使降临到我身边',
        }, 'TVDB TV Show Media Folder Initialization:import media folder by searching folder name in TVDB');

        await delay(10 * 1000)

        expect(await TvShowPanelCO.immersiveInput.getValue()).toBe('天使降临到了我身边！')

        const state = await TvShowPanelCO.toString()

        expect(state).toContain(`Season 0
S00E01 - - - -
S00E02 - - - -
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
S01E12 - - - -`)

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.tvShow).toBeDefined()
            expect(mm.tvShow?.id).toBe('355969')
            expect(mm.tvShow?.name).toBe('天使降临到了我身边！')
            expect(mm.tvShow?.database).toBe('TVDB')
            return true;
        })
        
    })

})
