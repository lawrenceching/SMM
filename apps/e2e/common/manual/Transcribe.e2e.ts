import * as fs from 'node:fs'
import path from 'node:path'
import { Path } from '@smm/core'
import Sidebar from 'test/componentobjects/Sidebar'
import { setup, cleanup, importFolderWithMediaMetadata } from 'test/lib/testbed'
import { createFolderInTestFolder, folder1, folder5 } from 'test/actions/import-folders'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import TranscribeDialogCO from 'test/componentobjects/TranscribeDialog.co'
import { readdirSync } from 'node:fs'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import { skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import { joinPlatformPath } from 'test/lib/browser-fs'
import page from 'test/pageobjects/page'

const tutorialVideoDir = path.join(import.meta.dirname, '../../../../test/media/tutorials')

describe('Transcribe', () => {
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
    })

    it('Transcribe TV show', async function() {

        this.timeout(5 * 60 * 1000)

        if (!fs.existsSync(tutorialVideoDir)) {
            throw new Error(
                `[Transcribe] Required test media folder does not exist: ${tutorialVideoDir}. ` +
                'Please create this folder and put sample video files in it (e.g. p1.mp4, p2.mp4).',
            )
        }

        const episodeFiles = ['S01E01.mp4', 'S01E02.mp4', 'S01E03.mp4'] as const
        const folder = createFolderInTestFolder({
            ...folder1,
            files: [...episodeFiles],
        })

        for (const [srcName, destName] of [
            ['p1.mp4', 'S01E01.mp4'],
            ['p2.mp4', 'S01E02.mp4'],
        ] as const) {
            const src = path.join(tutorialVideoDir, srcName)
            const dest = path.join(folder.path!, destName)
            fs.rmSync(dest)
            fs.copyFileSync(src, dest)
        }

        await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
            mediaMetadata.mediaFiles = episodeFiles.map((fileName, index) => ({
                absolutePath: Path.posix(joinPlatformPath(folder.path!, fileName)),
                seasonNumber: 1,
                episodeNumber: index + 1,
            }))
            return mediaMetadata
        })

        await page.refresh()
        await Sidebar.waitForFolderName(folder.folderName, 60000)
        await Sidebar.clickFolder(folder.folderName)
        await TvShowPanelCO.waitForTable(30_000)

        await TvShowPanelCO.clickHeaderTranscribe()

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

        if (!fs.existsSync(tutorialVideoDir)) {
            throw new Error(
                `[Transcribe] Required test media folder does not exist: ${tutorialVideoDir}. ` +
                'Please create this folder and put sample video files in it (e.g. p1.mp4).',
            )
        }

        const movieFileName = 'movie.mp4'
        const folder = createFolderInTestFolder({
            ...folder5,
            files: [movieFileName],
        })

        const destFile = path.join(folder.path!, movieFileName)
        fs.rmSync(destFile)
        fs.copyFileSync(path.join(tutorialVideoDir, 'p1.mp4'), destFile)

        const expectedTitle = folder5.translations?.title?.['en-US'] ?? 'The Dark Knight'
        await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
            mediaMetadata.type = 'movie-folder'
            mediaMetadata.tvShow = undefined
            mediaMetadata.mediaFiles = [
                {
                    absolutePath: Path.posix(joinPlatformPath(folder.path!, movieFileName)),
                },
            ]
            mediaMetadata.movie = {
                database: 'TVDB',
                id: '116',
                name: expectedTitle,
            }
            return mediaMetadata
        })

        await page.refresh()
        await Sidebar.waitForFolderName(folder.folderName, 60000)
        await Sidebar.clickFolder(folder.folderName)
        await MoviePanelCO.waitForTitleToBe(expectedTitle, 30_000)

        await MoviePanelCO.clickHeaderTranscribe()

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


    // MusicPanel transcribe cases: apps/e2e/common/manual/MusicPanel-Transcribe.e2e.ts
})
