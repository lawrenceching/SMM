import { expect } from '@wdio/globals'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, type TestFolder, folder4, folder5 } from '../../actions/import-folders'
import { openConfigDialog } from '../../actions/openConfigDialog'
import { setPrimaryDatabaseAndPreferLanguage } from '../../actions/setPrimaryDatabaseAndPreferLanguage'
import { setup } from '../../lib/testbed'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import ConfigDialog from 'test/componentobjects/ConfigDialog'

describe('TVDB Movie Media Folder Initialization', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        await openConfigDialog(async () => {
            expect(await ConfigDialog.isDisplayed()).toBe(true)
            if (env.slowdown) {
                await delay(1000)
            }

            await setPrimaryDatabaseAndPreferLanguage('TVDB', 'zh-CN')
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

    it('import media folder with tvdbid in folder name', async function() {

        if(env.slowdown) {
            this.timeout(60 * 1000)
        }
 
        const folder = await createAndImportFolder(folder5, 'TVDB Movie Media Folder Initialization:import media folder with tvdbid in folder name');

        await delay(10 * 1000)

        expect(await MoviePanelCO.input.getValue()).toBe('蝙蝠侠：黑暗骑士')

        const text = await MoviePanelCO.table.getText()

        expect(text).toContain(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.movie).toBeDefined()
            expect(mm.movie?.id).toBe('116')
            expect(mm.movie?.name).toBe('蝙蝠侠：黑暗骑士')
            expect(mm.movie?.database).toBe('TVDB')
            return true;
        })

    })

    it.only('import media folder by searching folder name in TVDB', async function() {

        if(env.slowdown) {
            this.timeout(60 * 1000)
        }
 
        const folder = await createAndImportFolder({
            ...folder5,
            folderName: 'Batman Return of the Caped Crusaders',
        }, 'TVDB Movie Media Folder Initialization:import media folder with tvdbid in folder name');

        await delay(10 * 1000)

        expect(await MoviePanelCO.input.getValue()).toBe('蝙蝠侠：披风斗士归来')

        const text = await MoviePanelCO.table.getText()

        expect(text).toContain(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.movie).toBeDefined()
            expect(mm.movie?.id).toBe('13611')
            expect(mm.movie?.name).toBe('蝙蝠侠：披风斗士归来')
            expect(mm.movie?.database).toBe('TVDB')
            return true;
        })

    })

})
