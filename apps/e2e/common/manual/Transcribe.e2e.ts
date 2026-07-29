import * as fs from 'node:fs'
import path from 'node:path'
import { Path } from '@smm/core'
import { expect, browser } from '@wdio/globals'
import Sidebar from 'test/componentobjects/Sidebar'
import { setup, cleanup, importFolderWithMediaMetadata } from 'test/lib/testbed'
import { createFolderInTestFolder, folder1, folder5 } from 'test/actions/import-folders'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import TranscribeDialogCO from 'test/componentobjects/TranscribeDialog.co'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import { isDockerE2e, skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import {
    createTestFolderViaBrowser,
    joinPlatformPath,
    listFileNamesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
    assertTutorialFixturesForCurrentPlatform,
    copyTutorialFileInDockerContainer,
    copyTutorialFileOnHost,
    waitForFolderFileNames,
} from 'test/lib/e2e-tutorial-fixtures'
import page from 'test/pageobjects/page'
import type { TestFolder } from 'test/actions/import-folders'

/**
 * TV show and movie header transcribe flows. Requires `test/media/tutorials/` fixtures.
 *
 * @supports local, Electron
 * @unsupported HarmonyOS, Docker
 */
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

    async function prepareTvShowFolderWithTutorialVideos(): Promise<TestFolder> {
        const episodeFiles = ['S01E01.mp4', 'S01E02.mp4', 'S01E03.mp4'] as const
        const folderDef: TestFolder = { ...folder1, files: [...episodeFiles] }

        if (isDockerE2e) {
            const root = await resolveSmmTestFolderViaBrowser()
            const folderPath = await createTestFolderViaBrowser(root, folderDef)
            folderDef.path = folderPath
            copyTutorialFileInDockerContainer('p1.mp4', joinPlatformPath(folderPath, 'S01E01.mp4'))
            copyTutorialFileInDockerContainer('p2.mp4', joinPlatformPath(folderPath, 'S01E02.mp4'))
            return folderDef
        }

        const folder = createFolderInTestFolder(folderDef)
        for (const [srcName, destName] of [
            ['p1.mp4', 'S01E01.mp4'],
            ['p2.mp4', 'S01E02.mp4'],
        ] as const) {
            const dest = path.join(folder.path!, destName)
            fs.rmSync(dest, { force: true })
            copyTutorialFileOnHost(srcName, dest)
        }
        return folder
    }

    async function prepareMovieFolderWithTutorialVideo(): Promise<{
        folder: TestFolder
        movieFileName: string
        expectedTitle: string
    }> {
        const movieFileName = 'movie.mp4'
        const folderDef: TestFolder = { ...folder5, files: [movieFileName] }
        const expectedTitle = folder5.translations?.title?.['en-US'] ?? 'The Dark Knight'

        if (isDockerE2e) {
            const root = await resolveSmmTestFolderViaBrowser()
            const folderPath = await createTestFolderViaBrowser(root, folderDef)
            folderDef.path = folderPath
            copyTutorialFileInDockerContainer('p1.mp4', joinPlatformPath(folderPath, movieFileName))
            return { folder: folderDef, movieFileName, expectedTitle }
        }

        const folder = createFolderInTestFolder(folderDef)
        const destFile = path.join(folder.path!, movieFileName)
        fs.rmSync(destFile, { force: true })
        copyTutorialFileOnHost('p1.mp4', destFile)
        return { folder, movieFileName, expectedTitle }
    }

    it('Transcribe TV show', async function () {
        this.timeout(5 * 60 * 1000)
        assertTutorialFixturesForCurrentPlatform()

        const episodeFiles = ['S01E01.mp4', 'S01E02.mp4', 'S01E03.mp4'] as const
        const folder = await prepareTvShowFolderWithTutorialVideos()

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

        await waitForFolderFileNames(folder.path!, ['S01E01.srt', 'S01E02.srt'])
    })

    it('Transcribe Movie', async function () {
        this.timeout(5 * 60 * 1000)
        assertTutorialFixturesForCurrentPlatform()

        const { folder, movieFileName, expectedTitle } = await prepareMovieFolderWithTutorialVideo()

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

        await browser.waitUntil(
            async () => {
                const names = await listFileNamesViaBrowser(folder.path!)
                return names.some((name) => name.endsWith('.srt'))
            },
            {
                timeout: 4 * 60 * 1000,
                timeoutMsg: 'Expected to see a .srt file in movie folder',
            },
        )

        const names = await listFileNamesViaBrowser(folder.path!)
        expect(names.some((name) => name.endsWith('.srt'))).toBe(true)
    })

    // MusicPanel transcribe cases: apps/e2e/common/manual/MusicPanel-Transcribe.e2e.ts
})
