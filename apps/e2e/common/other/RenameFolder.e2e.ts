import { expect } from '@wdio/globals'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import {
    cleanup,
    expectMediaMetadataViaBrowser,
    setup,
} from 'test/lib/testbed'
import { delay } from 'es-toolkit'
import {
    folder1,
    folder5,
    type TestFolder,
} from 'test/actions/import-folders'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import Sidebar from 'test/componentobjects/Sidebar'
import RenameDialog from 'test/componentobjects/RenameDialog'
import { Path } from '@smm/core'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

function renamedFolderPath(folderPath: string, folderName: string): string {
    const parent = folderPath.replace(/[/\\][^/\\]+$/, '')
    return joinPlatformPath(parent, `${folderName} - Renamed`)
}

describe('Rename Media Folder', () => {
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
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Rename TV Show folder', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folderPath = await createAndImportFolderViaBrowser(
            folder1,
            'e2eTest:RenameFolder',
            testFolder,
        )
        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForFolderTitle(folder1.translations?.title?.['en-US']!, 5000)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

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

        const folderPath = await createAndImportFolderViaBrowser(
            folder5,
            'e2eTest:RnameMovieFolder',
            testFolder,
        )
        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForFolderTitle(folder5.translations?.title?.['en-US']!, 5000)

        if (env.slowdown) {
            await delay(1 * 1000)
        }

        await browser.pause(4000)
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
        const folderPath = await createAndImportFolderViaBrowser(
            folder,
            'e2eTest:RnameMusicFolder',
            testFolder,
        )

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
