import { cleanup, setup } from "test/lib/testbed"
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    fileExistsViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from "test/lib/browser-fs"
import MusicPanel from "test/componentobjects/MusicPanel.co"
import DownloadVideoDialogCO from "test/componentobjects/DownloadVideoDialog.co"
import {
    countVideoFilesInFolderViaBrowser,
    expectFolderHasFileMatching,
    hasPartialDownloadsViaBrowser,
    waitForFolderVideosReadyViaBrowser,
} from "test/lib/download-folder"
import env from "test/lib/env"
import {
    assertBilibiliCookiesProvided,
    getBilibiliCookiesText,
    getOptionalNetscapeCookies,
    hasFirefoxCookieStore,
} from "test/lib/bilibili-cookies"

import { testbedOs } from 'test/lib/e2e-platform'

/** Delay between retries when clearFolderViaBrowser hits EBUSY (yt-dlp still writing). */
const CLEAR_FOLDER_EBUSY_RETRY_DELAY_MS = 10_000

/** Total sleep budget across EBUSY retries while clearing one folder. */
const CLEAR_FOLDER_EBUSY_RETRY_BUDGET_MS = 60_000

function isBusyFileError(message: string): boolean {
    return /\bEBUSY\b/i.test(message) || /resource busy or locked/i.test(message)
}

/**
 * Clears the download fixture folder, retrying on EBUSY while yt-dlp/ffmpeg
 * still holds a `.part` file open (common on Windows after Download tests).
 */
async function clearTestFolderRetryingBusy(folderPath: string): Promise<void> {
    let attempt = 0
    let totalWaitMs = 0
    let lastBusyError: string | null = null

    while (true) {
        attempt += 1
        try {
            await clearFolderViaBrowser(folderPath)
            if (attempt > 1) {
                console.log(
                    `MusicPanel-Download: cleared "${folderPath}" on attempt ${attempt} ` +
                    `(waited ${totalWaitMs}ms for EBUSY to clear)`,
                )
            }
            return
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)

            if (!isBusyFileError(message)) {
                throw new Error(
                    `MusicPanel-Download failed to clear folder "${folderPath}"` +
                    (attempt > 1 ? ` (attempt ${attempt})` : '') +
                    `: ${message}`,
                    { cause: err instanceof Error ? err : undefined },
                )
            }

            lastBusyError = message

            if (totalWaitMs >= CLEAR_FOLDER_EBUSY_RETRY_BUDGET_MS) {
                throw new Error(
                    `MusicPanel-Download failed to clear folder "${folderPath}" after ${attempt} attempt(s): ` +
                    `file remained locked (EBUSY) after waiting ${totalWaitMs}ms ` +
                    `(retry delay ${CLEAR_FOLDER_EBUSY_RETRY_DELAY_MS}ms, budget ${CLEAR_FOLDER_EBUSY_RETRY_BUDGET_MS}ms). ` +
                    `Last error: ${lastBusyError}`,
                    { cause: err instanceof Error ? err : undefined },
                )
            }

            const waitMs = Math.min(
                CLEAR_FOLDER_EBUSY_RETRY_DELAY_MS,
                CLEAR_FOLDER_EBUSY_RETRY_BUDGET_MS - totalWaitMs,
            )
            console.warn(
                `MusicPanel-Download: clearFolderViaBrowser("${folderPath}") locked (EBUSY) on attempt ${attempt}; ` +
                `retrying in ${waitMs}ms (${CLEAR_FOLDER_EBUSY_RETRY_BUDGET_MS - totalWaitMs - waitMs}ms retry budget left)`,
            )
            const { setTimeout } = await import('node:timers/promises')
            await setTimeout(waitMs)
            totalWaitMs += waitMs
        }
    }
}

async function openDownloadDialog() {
    await MusicPanel.downloadButton.waitForExist()
    await MusicPanel.downloadButton.waitForStable()
    await MusicPanel.downloadButton.waitForClickable()
    await MusicPanel.downloadButton.click()

    const dvd = DownloadVideoDialogCO
    await dvd.waitForDisplayed()
    expect(dvd.agreementCheckbox).toBeDisplayed()
    await dvd.setAgreement(true)
    return dvd
}

/**
 * Real yt-dlp download flows (Bilibili / YouTube). Requires network, cookies, and bundled yt-dlp.
 *
 * @supports local, Electron
 * @unsupported HarmonyOS, Docker
 */
describe('MusicPanel - Download', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearTestFolderRetryingBusy(testFolder)
    })

    afterEach(async () => {
        if (await DownloadVideoDialogCO.isDisplayed()) {
            try {
                await DownloadVideoDialogCO.clickCancel()
                await DownloadVideoDialogCO.waitForClosed(5000)
            } catch {
                await browser.keys(['\uE00C'])
                await browser.pause(500)
            }
        }

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearTestFolderRetryingBusy(testFolder)
        }
    })

    describe('Bilibili', () => {
        let bilibiliCookies: string

        before(function () {
            assertBilibiliCookiesProvided()
            bilibiliCookies = getBilibiliCookiesText()
        })

    it('Download Bilibili Video', async function () {
        this.timeout(5 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Video", testFolder)

        const dvd = await openDownloadDialog()

        expect(dvd.episodesList).not.toBeExisting()

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.probeUrl("https://www.bilibili.com/video/BV17NrWBaE87/", {
            cookiesText: bilibiliCookies,
            timeout: 90_000,
        })
        await dvd.setMoreOptions(true)
        await dvd.setWriteThumbnail(true)
        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 1,
            timeout: 3 * 60 * 1000,
            timeoutMsg: "Expected completed Bilibili video (no .part files)",
        })

        await expectFolderHasFileMatching(folderPath, /BV17NrWBaE87.*\.(jpg|webp|png)$/i)
        await expectFolderHasFileMatching(folderPath, /BV17NrWBaE87.*\.mp4$/i)
    })

    // Unstable
    it('Download Bilibili Episodes', async function () {
        this.timeout(5 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Episodes", testFolder)

        const dvd = await openDownloadDialog()

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.probeUrl("https://www.bilibili.com/video/BV1rY4y1P7er/", {
            cookiesText: bilibiliCookies,
            timeout: 90_000,
        })

        await browser.waitUntil(async () => {
            const list = await dvd.episodesListItems
            return (await list.length) >= 18
        }, {
            timeout: 60 * 1000,
            interval: 1000,
        })

        await dvd.uncheckEpisodesExcept([0, 1])
        await dvd.dumpStartButtonDebugInfo()

        await dvd.setMoreOptions(true)
        await dvd.setWriteThumbnail(true)
        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 2,
            timeout: 5 * 60 * 1000,
            timeoutMsg: "Expected 2 completed episode videos (no .part files)",
        })

        await expectFolderHasFileMatching(folderPath, /BV1rY4y1P7er_p1.*\.mp4$/i)
        await expectFolderHasFileMatching(folderPath, /BV1rY4y1P7er_p2.*\.mp4$/i)
        await expectFolderHasFileMatching(folderPath, /BV1rY4y1P7er_p2.*\.(jpg|webp|png)$/i)
    })

    it('Download Bilibili Collection', async function () {
        this.timeout(5 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Collection", testFolder)

        const dvd = await openDownloadDialog()

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.probeUrl("https://space.bilibili.com/651386960/lists/1903590?type=season", {
            cookiesText: bilibiliCookies,
            timeout: 90_000,
        })
        await dvd.selectVideoFormat("720p")

        if (env.slowdown) {
            await browser.pause(4000)
        }

        const collectionCount = await dvd.waitForVideoListLoaded({
            minItems: 4,
            timeout: 60 * 1000,
        })
        console.log(`[MusicPanel-Download] Video list loaded with ${collectionCount} items`)

        await dvd.uncheckEpisodesExcept([0, 1, 2])
        await dvd.dumpStartButtonDebugInfo()
        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 3,
            timeout: 4 * 60 * 1000,
            timeoutMsg: "Expected 3 completed collection videos (no .part files)",
        })

        expect(await countVideoFilesInFolderViaBrowser(folderPath)).toBe(3)
        expect(await hasPartialDownloadsViaBrowser(folderPath)).toBe(false)
    })
    })

    it('Download Youtube Video', async function () {
        this.timeout(3 * 60 * 1000)

        const youtubeCookies = getOptionalNetscapeCookies('YOUTUBE_COOKIES', 'YOUTUBE_COOKIES_FILE')
        if (!youtubeCookies && !hasFirefoxCookieStore()) {
            this.skip()
        }

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Youtube Video", testFolder)

        const dvd = await openDownloadDialog()

        expect(dvd.urlInput).toBeDisplayed()
        if (youtubeCookies) {
            await dvd.probeUrl("https://www.youtube.com/watch?v=2JgVKe64nl0", {
                cookiesText: youtubeCookies,
                timeout: 90_000,
            })
        } else {
            await dvd.probeUrlWithBrowserCookies(
                "https://www.youtube.com/watch?v=2JgVKe64nl0",
                'firefox',
                { timeout: 90_000 },
            )
        }
        await dvd.setMoreOptions(true)
        await dvd.setWriteThumbnail(true)
        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 1,
            timeout: 1.8 * 60 * 1000,
            timeoutMsg: "Expected completed YouTube video (no .part files)",
        })

        expect(await fileExistsViaBrowser(joinPlatformPath(
            folderPath,
            "【宇宙雜談】重大發現！W玻色子超重嚴重？希格斯機制遇到大問題？｜ Linvo說宇宙 [2JgVKe64nl0].mkv",
        ))).toBe(true)
        expect(await fileExistsViaBrowser(joinPlatformPath(
            folderPath,
            "【宇宙雜談】重大發現！W玻色子超重嚴重？希格斯機制遇到大問題？｜ Linvo說宇宙 [2JgVKe64nl0].webp",
        ))).toBe(true)
    })
})

