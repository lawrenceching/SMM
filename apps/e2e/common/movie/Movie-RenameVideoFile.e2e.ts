import { expect, browser } from '@wdio/globals'
import RenameDialog from 'test/componentobjects/RenameDialog'
import Sidebar from 'test/componentobjects/Sidebar'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    listFileNamesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { waitUntilSelectedFolderReady } from 'test/lib/ui-media-folder-store'
import { clickContextMenuItem, rightClickElement } from 'test/lib/context-menu'

import { testbedOs } from 'test/lib/e2e-platform'

// Movie folder with TMDB ID so the app loads TMDB data and shows the movie panel with Files section.
// 615453 = 哪吒之魔童降世 (2019). Do not use 552524 — that id is Lilo & Stitch on TMDB.
const FOLDER_NAME = '哪吒之魔童降世 (2019) {tmdbid=615453}'
const EXPECTED_MOVIE_TITLES = ['哪吒之魔童降世', 'Ne Zha'] as const
const VIDEO_FILE_NAME = 'movie.mp4'
const RENAMED_FILE_NAME = 'movie_renamed.mp4'

/**
 * Associated files that share the same stem as the movie video.
 * Renamed implicitly when the video file is renamed via context menu.
 */
const ASSOCIATED_FILES = ['movie.srt', 'movie.en.srt', 'movie.ass'] as const
const RENAMED_ASSOCIATED_FILES = ['movie_renamed.srt', 'movie_renamed.en.srt', 'movie_renamed.ass'] as const

/** Rename button in movie overview header (en and zh-CN) — signals TMDB data and Files section are ready. */
const RENAME_BUTTON_LABELS = ['Rename', '重命名']

/** Rename context menu item text (en and zh-CN). */
const RENAME_MENU_ITEM_LABELS = ['Rename', '重命名']

/** Sidebar displays folder basename for movie (AppV2 mediaName fallback). */
const SIDEBAR_FOLDER_DISPLAY_NAME = FOLDER_NAME

async function waitForMoviePanelRenameButtonDisplayed() {
    await waitUntilSelectedFolderReady(3 * 60 * 1000)
    await MoviePanelCO.searchbox.waitForTitleToBeOneOf(EXPECTED_MOVIE_TITLES, 3 * 60 * 1000)
    await browser.waitUntil(
        async () => {
            for (const label of RENAME_BUTTON_LABELS) {
                const btn = await $(`button=${label}`)
                if (await btn.isDisplayed().catch(() => false)) return true
            }
            return false
        },
        { timeout: 30000, interval: 500, timeoutMsg: 'Rename button did not appear in movie overview' },
    )
}

async function waitForFilesInFolder(
    folderPath: string,
    options: {
        mustInclude: string[]
        mustExclude: string[]
        timeout?: number
    },
): Promise<void> {
    const { mustInclude, mustExclude, timeout = 30_000 } = options
    await browser.waitUntil(
        async () => {
            const names = await listFileNamesViaBrowser(folderPath)
            return (
                mustInclude.every((name) => names.includes(name)) &&
                mustExclude.every((name) => !names.includes(name))
            )
        },
        {
            timeout,
            interval: 500,
            timeoutMsg:
                `Rename did not update files in ${folderPath}. ` +
                `Expected: ${mustInclude.join(', ')}; removed: ${mustExclude.join(', ')}`,
        },
    )
}

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Movie - Rename Video File', () => {
    let testFolder = ''
    let movieFolderPath = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config) => {
                config.preferMediaLanguage = 'zh-CN'
                return config
            },
            os: testbedOs,
        })

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

    it('renames the video file and its associated files (subtitles, etc.) via context menu', async function () {
        this.timeout(6 * 60 * 1000)

        movieFolderPath = await createAndImportFolderViaBrowser(
            {
                folderName: FOLDER_NAME,
                type: 'movie',
                files: [VIDEO_FILE_NAME, ...ASSOCIATED_FILES],
            },
            'e2eTest:Movie Rename Video File',
        )

        await delay(3 * 1000)

        const folderDisplayed = await Sidebar.waitForFolderName(SIDEBAR_FOLDER_DISPLAY_NAME, 30000)
        expect(folderDisplayed).toBe(true)
        await Sidebar.waitForFolderSelected(SIDEBAR_FOLDER_DISPLAY_NAME, 30000)
        await waitForMoviePanelRenameButtonDisplayed()

        await browser.waitUntil(
            async () => {
                const fileDivs = await $$('div.truncate')
                for (const el of fileDivs) {
                    const text = (await el.getText()).trim()
                    if (text === VIDEO_FILE_NAME) return true
                }
                return false
            },
            { timeout: 10000, interval: 300, timeoutMsg: 'Video file row did not appear in Movie Files section' },
        )

        const videoFileRow = await $(`//div[contains(@class,"truncate") and normalize-space(text())="${VIDEO_FILE_NAME}"]/ancestor::tr`)
        await videoFileRow.waitForDisplayed({ timeout: 5000 })
        await rightClickElement(videoFileRow)
        await clickContextMenuItem(RENAME_MENU_ITEM_LABELS)

        const dialogDisplayed = await RenameDialog.waitForDisplayed(5000)
        expect(dialogDisplayed).toBe(true)
        const inputValue = await RenameDialog.getInputValue()
        expect(inputValue).toBe(VIDEO_FILE_NAME)

        expect(await RenameDialog.isConfirmDisabled()).toBe(true)

        await RenameDialog.setInputValue(RENAMED_FILE_NAME)
        expect(await RenameDialog.getInputValue()).toBe(RENAMED_FILE_NAME)
        expect(await RenameDialog.isConfirmDisabled()).toBe(false)

        await RenameDialog.clickConfirm()
        await RenameDialog.waitForClosed()

        await waitForFilesInFolder(movieFolderPath, {
            mustInclude: [RENAMED_FILE_NAME, ...RENAMED_ASSOCIATED_FILES],
            mustExclude: [VIDEO_FILE_NAME, ...ASSOCIATED_FILES],
        })

        const filesInMediaFolder = await listFileNamesViaBrowser(movieFolderPath)
        expect(filesInMediaFolder).toContain(RENAMED_FILE_NAME)
        expect(filesInMediaFolder).not.toContain(VIDEO_FILE_NAME)

        for (let i = 0; i < ASSOCIATED_FILES.length; i++) {
            expect(filesInMediaFolder).toContain(RENAMED_ASSOCIATED_FILES[i]!)
            expect(filesInMediaFolder).not.toContain(ASSOCIATED_FILES[i]!)
        }
    })
})
