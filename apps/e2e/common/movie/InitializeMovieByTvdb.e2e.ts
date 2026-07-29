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
import { given, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata } from '@smm/core/types'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'

import { testbedOs } from 'test/lib/e2e-platform'

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
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
            os: testbedOs,
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
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('import media folder with tvdbid in folder name', async function () {
        this.timeout(6 * 60 * 1000)

        await given('Movie folder was initialized by TVDB ID')

        await then('movie panel shows the expected TVDB movie title', async () => {
            // Avoid fixed delay + getValue while status=initializing (Skeleton hides input).
            await MoviePanelCO.waitForTitleToBe('蝙蝠侠：黑暗骑士', 3 * 60 * 1000)
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

        await then('movie panel shows the expected searched TVDB movie title', async () => {
            await MoviePanelCO.waitForTitleToBe('蝙蝠侠：披风斗士归来', 3 * 60 * 1000)
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
