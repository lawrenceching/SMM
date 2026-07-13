import { expect, browser } from '@wdio/globals'
import { setup, cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'

describe('Import Media Library', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        const { default: Menu } = await import('../../componentobjects/Menu')
        const { default: ConfigDialog } = await import('../../componentobjects/ConfigDialog')
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.switchToTab('media-databases')
        await ConfigDialog.setPrimaryDatabase('TMDB')
        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.switchToTab('general')
        await ConfigDialog.setPreferMediaLanguage('zh-CN')
        if (env.slowdown) {
            await delay(1000)
        }

        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(1000)

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

    it('Import TV Show Library', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('Media library was imported with TV show folders')

        await delay(30 * 1000)

        const folders = getStepContext()._folders as Array<{ folderName: string; path: string; type: string }>

        await then('unknown folder has no tvshow metadata', async () => {
            const f = folders.find(f => f.folderName === 'UnknownFolder')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow).toBeUndefined()
                return true
            })
        })

        await then('folder recognized by name has TMDB tvshow metadata', async () => {
            const { folder1 } = await import('../../actions/import-folders')
            const f = folders.find(f => f.folderName === folder1.folderName)!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by tmdbid has TMDB tvshow metadata', async () => {
            const f = folders.find(f => f.folderName === '{tmdbid=84666}')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by NFO has TMDB tvshow metadata', async () => {
            const f = folders.find(f => f.folderName === 'FolderContainsTvShowNfo')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('tvshow-folder')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })
    })

    it('Import Movie Library', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('Media library was imported with movie folders')

        await delay(30 * 1000)

        const folders = getStepContext()._folders as Array<{ folderName: string; path: string; type: string }>

        await then('unknown folder has no movie metadata', async () => {
            const f = folders.find(f => f.folderName === 'UnknownFolder')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie).toBeUndefined()
                return true
            })
        })

        await then('folder recognized by name has TMDB movie metadata', async () => {
            const { folder2 } = await import('../../actions/import-folders')
            const f = folders.find(f => f.folderName === folder2.folderName)!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by tmdbid has TMDB movie metadata', async () => {
            const f = folders.find(f => f.folderName === '{tmdbid=1539104}')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })

        await then('folder recognized by NFO has TMDB movie metadata', async () => {
            const f = folders.find(f => f.folderName === 'FolderContainsMovieNfo')!
            await expectMediaMetadataToBe(f.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.mediaFolderPath).toBe(Path.posix(f.path))
                expect(mm.type).toBe('movie-folder')
                expect(mm.movie?.database).toBe('TMDB')
                return true
            })
        })
    })
})
