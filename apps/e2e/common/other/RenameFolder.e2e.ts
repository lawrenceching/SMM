import { expect, browser } from '@wdio/globals'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import { skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import {
    cleanup,
    expectMediaMetadataViaBrowser,
    importFolderWithMediaMetadata,
    setup,
} from 'test/lib/testbed'
import { delay } from 'es-toolkit'
import {
    folder1,
    folder5,
    type TestFolder,
} from 'test/actions/import-folders'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/types'
import Sidebar from 'test/componentobjects/Sidebar'
import RenameDialog from 'test/componentobjects/RenameDialog'
import { Path } from '@smm/utils/path'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import {
    clearFolderViaBrowser,
    createTestFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

function renamedFolderPath(folderPath: string, folderName: string): string {
    const parent = folderPath.replace(/[/\\][^/\\]+$/, '')
    return joinPlatformPath(parent, `${folderName} - Renamed`)
}

async function importRecognizedTvShowFolder(
    folder: TestFolder,
    testFolder: string,
): Promise<string> {
    const folderPath = await createTestFolderViaBrowser(testFolder, folder)
    folder.path = folderPath
    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')
    const { default: Page } = await import('test/pageobjects/page')
    await Page.refresh()
    await Sidebar.waitForFolderName(folder.folderName, 60_000)
    return folderPath
}

async function importRecognizedMovieFolder(
    folder: TestFolder,
    testFolder: string,
): Promise<string> {
    const folderPath = await createTestFolderViaBrowser(testFolder, folder)
    folder.path = folderPath
    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.type = 'movie-folder'
        mediaMetadata.tvShow = undefined
        mediaMetadata.mediaFiles = folder.files.map((file) => ({
            absolutePath: Path.posix(joinPlatformPath(folder.path!, file)),
        }))
        mediaMetadata.movie = {
            database: 'TVDB',
            id: '116',
            name: folder5.translations?.title?.['en-US'] ?? 'The Dark Knight',
        }
        return mediaMetadata
    })
    const { default: Page } = await import('test/pageobjects/page')
    await Page.refresh()
    await Sidebar.waitForFolderName(folder.folderName, 60_000)
    return folderPath
}

/**
 * Rename media folder via UI.
 *
 * HarmonyOS: the sandbox does not allow renaming folders — skip rather than
 * assert a rename that cannot succeed.
 *
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('Rename Media Folder', () => {
    let testFolder = ''

    before(function () {
        skipIfOhos(this)
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            os: testbedOs,
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()
        await browser.pause(2000)

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

    it('Rename TV Show folder', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folderPath = await importRecognizedTvShowFolder({ ...folder1 }, testFolder)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        expect(await TvShowPanelCO.toString()).toBe(`Specials
S00E01 - - - -
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

        await Sidebar.rightClickFolderByFolderName(folder1.folderName)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForContextMenu()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.clickContextMenuRename()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.waitForDisplayed()

        expect(await RenameDialog.input.getValue()).toBe(folder1.folderName)

        await RenameDialog.setInputValue(`${folder1.folderName} - Renamed`)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.clickConfirm()

        await RenameDialog.waitForClosed()

        await browser.pause(2000)

        expect(await TvShowPanelCO.toString()).toBe(`Specials
S00E01 - - - -
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

        const newFolderPath = renamedFolderPath(folderPath, folder1.folderName)
        await expectMediaMetadataViaBrowser(newFolderPath, (obj) => {
            const mm = obj as MediaMetadata
            expect(mm.mediaFolderPath).toBe(Path.posix(newFolderPath))
            const expectedMediaFiles = [
                {
                    absolutePath: Path.posix(joinPlatformPath(newFolderPath, 'S01E01.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 1,
                },
                {
                    absolutePath: Path.posix(joinPlatformPath(newFolderPath, 'S01E02.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 2,
                },
                {
                    absolutePath: Path.posix(joinPlatformPath(newFolderPath, 'S01E03.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 3,
                },
            ]
            expect(mm.mediaFiles).toEqual(expectedMediaFiles)
            return true
        })
    })

    it('Rename Movie folder', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folderPath = await importRecognizedMovieFolder({ ...folder5 }, testFolder)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        expect(await MoviePanelCO.table.getText()).toBe(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)

        await Sidebar.rightClickFolderByFolderName(folder5.folderName)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForContextMenu()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.clickContextMenuRename()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.waitForDisplayed()

        expect(await RenameDialog.input.getValue()).toBe(folder5.folderName)

        await RenameDialog.setInputValue(`${folder5.folderName} - Renamed`)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.clickConfirm()

        await RenameDialog.waitForClosed()

        expect(await MoviePanelCO.table.getText()).toBe(`ID Video File Thumb Sub NFO
Movie
S01E01
The Dark Knight [1080P].mkv`)

        const newFolderPath = renamedFolderPath(folderPath, folder5.folderName)
        await expectMediaMetadataViaBrowser(newFolderPath, (obj) => {
            const mm = obj as MediaMetadata
            expect(mm.mediaFolderPath).toBe(Path.posix(newFolderPath))
            const expectedMediaFiles = [
                {
                    absolutePath: Path.posix(
                        joinPlatformPath(newFolderPath, 'The Dark Knight [1080P].mkv'),
                    ),
                },
            ]
            expect(mm.mediaFiles).toEqual(expectedMediaFiles)
            return true
        })
    })

    /**
     * TODO: createAndImportFolder method unable to import music folder. Need to fix.
     */
    it.skip('Rename Musc Folder', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder: TestFolder = {
            folderName: 'music',
            files: ['song1.mp3', 'song2.mp3'],
            type: 'music',
        }
        const folderPath = await createTestFolderViaBrowser(testFolder, folder)

        await Sidebar.waitForFolderName(folder.folderName, 5000)

        if (env.slowdown) {
            await delay(10 * 1000)
        }

        await Sidebar.rightClickFolderByFolderName(folder.folderName)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForContextMenu()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.clickContextMenuRename()

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.waitForDisplayed()

        expect(await RenameDialog.input.getValue()).toBe(folder.folderName)

        const newFolderName = `${folder.folderName} - Renamed`
        await RenameDialog.setInputValue(newFolderName)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.clickConfirm()

        await RenameDialog.waitForClosed()

        await Sidebar.waitForFolderName(newFolderName, 5000)

        const newFolderPath = renamedFolderPath(folderPath, folder.folderName)
        await expectMediaMetadataViaBrowser(newFolderPath, (obj) => {
            const mm = obj as MediaMetadata
            expect(mm.mediaFolderPath).toBe(Path.posix(newFolderPath))
            return true
        })
    })
})
