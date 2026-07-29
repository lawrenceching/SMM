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
import { Path } from '@smm/core'

import { testbedOs } from 'test/lib/e2e-platform'

/**
 * Import a movie media library (common: browser / Electron / HarmonyOS).
 * Fixtures, config, and metadata assertions use browser-protocol APIs only.
 *
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Import Movie Library', () => {
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
                config.primaryDatabase = 'TMDB'
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

    it('Import Movie Library', async function () {
        this.timeout(6 * 60 * 1000)

        await given('Media library was imported with movie folders', {
            base: testFolder,
        })

        await delay(30 * 1000)

        const folders = getStepContext()._folders as Array<{
            folderName: string
            path: string
            type: string
        }>

        await then('unknown folder has no movie metadata', async () => {
            const f = folders.find((x) => x.folderName === 'UnknownFolder')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie).toBeUndefined()
                return true
            })
        })

        await then('folder recognized by name has TMDB movie metadata', async () => {
            const { folder2 } = await import('test/actions/import-folders')
            const f = folders.find((x) => x.folderName === folder2.folderName)!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by tmdbid has TMDB movie metadata', async () => {
            const f = folders.find((x) => x.folderName === '{tmdbid=1539104}')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by NFO has TMDB movie metadata', async () => {
            const f = folders.find((x) => x.folderName === 'FolderContainsMovieNfo')!
            await expectMediaMetadataViaBrowser(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })
    })
})
