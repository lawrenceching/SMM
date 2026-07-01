import * as fs from 'node:fs'
import path from 'node:path'
import Sidebar from '../../componentobjects/Sidebar'
import { setup, cleanup } from '../../lib/testbed'
import { createAndImportFolder, folder1, folder5 } from 'test/actions/import-folders'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import TranscribeDialogCO from 'test/componentobjects/TranscribeDialog.co'
import { readdirSync } from 'node:fs'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import SearchboxCO from 'test/componentobjects/Searchbox.co'

describe('Transcribe', () => {

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

    it('Transcribe TV show', async function() {

        this.timeout(5 * 60 * 1000)

        const folder = await createAndImportFolder({
            ...folder1,
            files: [
                'S01E01.mp4',
                'S01E02.mp4',
                'S01E03.mp4',
            ],
        }, 'e2eTest:Transcribe TV show')

        await Sidebar.waitForFolderName(folder.folderName, 60000);
        await TvShowPanelCO.waitForTitleToBe(folder.translations?.title?.['en-US'] ?? 'N/A');

        [{
            src: path.join(import.meta.dirname, '../../../../../test/media/tutorials/p1.mp4'),
            dest: path.join(folder.path!, 'S01E01.mp4'),
        }, {
            src: path.join(import.meta.dirname, '../../../../../test/media/tutorials/p2.mp4'),
            dest: path.join(folder.path!, 'S01E02.mp4'),
        }].forEach(({ src, dest }) => {
            fs.rmSync(dest)
            fs.copyFileSync(src, dest)
        })

        await TvShowPanelCO.transcribeButton.click()

        await TranscribeDialogCO.confirmButton.waitForExist()
        await TranscribeDialogCO.confirmButton.click()

        await browser.waitUntil(async () => {
            const files = readdirSync(folder.path!)
            const containsSrt1 = files.find(file => file.endsWith('S01E01.srt')) !== undefined
            const containsSrt2 = files.find(file => file.endsWith('S01E02.srt')) !== undefined
            return containsSrt1 && containsSrt2
        }, {
            timeout: 4 * 60 * 1000,
            timeoutMsg: 'Expected to see S01E01.srt and S01E02.srt in folder',
        })
    })

    it('Transcribe Movie', async function() {

        this.timeout(5 * 60 * 1000)

        const folder = await createAndImportFolder({
            ...folder5,
            files: ['movie.mp4'],
        }, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder.folderName, 60000)

        const sourceFile = path.join(import.meta.dirname, '../../../../../test/media/tutorials/p1.mp4')
        const destFile = path.join(folder.path!, folder.files[0]!)

        fs.rmSync(destFile)
        fs.copyFileSync(sourceFile, destFile)

        await MoviePanelCO.transcribeButton.click()

        await TranscribeDialogCO.confirmButton.waitForExist()
        await TranscribeDialogCO.confirmButton.click()

        await browser.waitUntil(async () => {
            const files = readdirSync(folder.path!)
            return files.find(file => file.endsWith('.srt')) !== undefined
        }, {
            timeout: 4 * 60 * 1000,
            timeoutMsg: 'Expected to see movie.srt in folder',
        })

        expect(folder).toContainFile("movie.srt")
    })


    // test case for MusicPanel is in: apps\e2e\test\specs\music\MusicPanel-Transcribe.e2e.ts
})
