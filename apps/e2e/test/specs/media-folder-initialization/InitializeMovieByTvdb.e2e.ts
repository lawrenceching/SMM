import { expect } from '@wdio/globals'
import { setup, cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
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

        const { openConfigDialog } = await import('../../actions/openConfigDialog')
        // Set primary database to TVDB (save on media-databases tab before switching away)
        await openConfigDialog(async () => {
            expect(await ConfigDialog.isDisplayed()).toBe(true)
            if (env.slowdown) {
                await delay(1000)
            }
            await ConfigDialog.switchToTab('media-databases')
            await ConfigDialog.setPrimaryDatabase('TVDB')
        })
        // Set prefer media language (separate dialog session, stays on general tab)
        await openConfigDialog(async () => {
            expect(await ConfigDialog.isDisplayed()).toBe(true)
            if (env.slowdown) {
                await delay(1000)
            }
            await ConfigDialog.switchToTab('general')
            await ConfigDialog.setPreferMediaLanguage('zh-CN')
        })

        resetStepContext()
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

    it('import media folder with tvdbid in folder name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('Movie folder was initialized by TVDB ID')

        await delay(10 * 1000)

        await then('movie panel shows the expected TVDB movie title', async () => {
            expect(await MoviePanelCO.input.getValue()).toBe('蝙蝠侠：黑暗骑士')
        })

        await then('movie panel table shows the expected content', async () => {
            const text = await MoviePanelCO.table.getText()
            expect(text).toContain(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)
        })

        await then('metadata is persisted with TVDB movie id 116', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataToBe(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.movie).toBeDefined()
                expect(mm.movie?.id).toBe('116')
                expect(mm.movie?.name).toBe('蝙蝠侠：黑暗骑士')
                expect(mm.movie?.database).toBe('TVDB')
                return true
            })
        })
    })

    it.only('import media folder by searching folder name in TVDB', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('Movie folder "Batman Return of the Caped Crusaders" was initialized by TVDB folder name')

        await delay(10 * 1000)

        await then('movie panel shows the expected searched TVDB movie title', async () => {
            expect(await MoviePanelCO.input.getValue()).toBe('蝙蝠侠：披风斗士归来')
        })

        await then('movie panel table shows the expected content', async () => {
            const text = await MoviePanelCO.table.getText()
            expect(text).toContain(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)
        })

        await then('metadata is persisted with TVDB movie id 13611', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataToBe(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.movie).toBeDefined()
                expect(mm.movie?.id).toBe('13611')
                expect(mm.movie?.name).toBe('蝙蝠侠：披风斗士归来')
                expect(mm.movie?.database).toBe('TVDB')
                return true
            })
        })
    })
})
