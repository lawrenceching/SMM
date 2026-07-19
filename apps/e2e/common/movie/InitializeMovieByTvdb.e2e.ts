import { expect } from '@wdio/globals'
import {
    setup,
    cleanup,
    expectMediaMetadataViaBrowser,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { given, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata } from '@smm/core/types'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'

describe('Initialize Movie by TVDB', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config) => {
                config.primaryDatabase = 'TVDB'
                config.preferMediaLanguage = 'zh-CN'
            },
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()

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

    it('import media folder with tvdbid in folder name', async function () {
        this.timeout(6 * 60 * 1000)

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
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.movie).toBeDefined()
                expect(mm.movie?.id).toBe('116')
                expect(mm.movie?.name).toBe('蝙蝠侠：黑暗骑士')
                expect(mm.movie?.database).toBe('TVDB')
                return true
            })
        })
    })

    it('import media folder by searching folder name in TVDB', async function () {
        this.timeout(6 * 60 * 1000)

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
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
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
