import { expect } from '@wdio/globals'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, folder1 } from '../actions/import-folders'
import { setup } from '../lib/testbed'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'

import Sidebar from 'test/componentobjects/Sidebar'
import RenameDialog from 'test/componentobjects/RenameDialog'
import path from 'path'
import { Path } from '@smm/core'

describe('Rename Media Folder', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
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

    it('Rename TV Show folder', async function() {

        if(env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder(folder1, 'e2eTest:RenameFolder')
        if(env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForFolder(folder1.translations?.title?.['en-US']!, 5000)

        if(env.slowdown) {
            await delay(1 * 1000)
        }

        browser.pause(4000)
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

        await Sidebar.rightClickFolder(folder1.translations?.title?.['en-US']!);

        if(env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.waitForContextMenu();

        if(env.slowdown) {
            await delay(1 * 1000)
        }

        await Sidebar.clickContextMenuRename();

        if(env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.waitForDisplayed()

        expect(await RenameDialog.input.getValue()).toBe(folder.folderName)
        
        await RenameDialog.setInputValue(`${folder.folderName} - Renamed`)

        if(env.slowdown) {
            await delay(1 * 1000)
        }

        await RenameDialog.clickConfirm()

        await RenameDialog.waitForClosed()

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

        const newFolderPath = folder.path!.replace(folder.folderName, `${folder.folderName} - Renamed`)
        await expectMediaMetadataToBe(newFolderPath, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.mediaFolderPath).toBe(Path.posix(newFolderPath))
            const expectedMediaFiles = [
                {
                    absolutePath: Path.posix(path.join(newFolderPath, 'S01E01.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 1
                },
                {
                    absolutePath: Path.posix(path.join(newFolderPath, 'S01E02.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 2
                },
                {
                    absolutePath: Path.posix(path.join(newFolderPath, 'S01E03.mkv')),
                    seasonNumber: 1,
                    episodeNumber: 3
                }
            ]
            expect(mm.mediaFiles).toEqual(expectedMediaFiles)
            return true;
        })

    })

})
