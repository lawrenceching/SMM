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
    hasPartialDownloadsViaBrowser,
    waitForFolderVideosReadyViaBrowser,
} from "test/lib/download-folder"
import env from "test/lib/env"

import { testbedOs } from 'test/lib/e2e-platform'

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
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
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
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Download Bilibili Video', async function () {
        this.timeout(2 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Video", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        const dvd = DownloadVideoDialogCO
        await dvd.waitForDisplayed()

        expect(dvd.agreementCheckbox).toBeDisplayed()
        await dvd.setAgreement(true)

        expect(dvd.episodesList).not.toBeExisting()

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.setUrl("https://www.bilibili.com/video/BV17NrWBaE87/")
        await dvd.setMoreOptions(true)
        await dvd.setWriteThumbnail(true)
        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 1,
            timeout: 90_000,
            timeoutMsg: "Expected completed Bilibili video (no .part files)",
        })

        expect(await fileExistsViaBrowser(joinPlatformPath(
            folderPath,
            "ピノキオピー - 不死身ごっこ feat. 初音ミク [BV17NrWBaE87].jpg",
        ))).toBe(true)
        expect(await fileExistsViaBrowser(joinPlatformPath(
            folderPath,
            "ピノキオピー - 不死身ごっこ feat. 初音ミク [BV17NrWBaE87].mp4",
        ))).toBe(true)
    })

    it('shows downloaded Bilibili title in table', async function () {
        this.timeout(2 * 60 * 1000)

        await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:shows downloaded Bilibili title in table", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        const dvd = DownloadVideoDialogCO
        await dvd.waitForDisplayed()

        expect(dvd.agreementCheckbox).toBeDisplayed()
        await dvd.setAgreement(true)

        expect(dvd.episodesList).not.toBeExisting()

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.setUrl(
            "https://www.bilibili.com/video/BV1bW411a7jV/?spm_id_from=333.1007.top_right_bar_window_custom_collection.content.click&vd_source=3c26ab71aea3361663e8d90d502ac593",
        )
        await dvd.clickStart()

        await MusicPanel.waitForRowTitleContaining("煙花")
    })

    // Unstable
    it('Download Bilibili Episodes', async function () {
        this.timeout(2 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Episodes", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        const dvd = DownloadVideoDialogCO
        await dvd.waitForDisplayed()

        expect(dvd.agreementCheckbox).toBeDisplayed()
        await dvd.setAgreement(true)

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.setUrl("https://www.bilibili.com/video/BV1rY4y1P7er/")

        await browser.waitUntil(async () => {
            const list = await dvd.episodesListItems
            return (await list.length) >= 18
        }, {
            timeout: 60 * 1000,
            interval: 1000,
        })

        await dvd.uncheckEpisodesExcept([0, 1])
        await dvd.dumpStartButtonDebugInfo()

        await dvd.clickStart()

        await waitForFolderVideosReadyViaBrowser(folderPath, {
            minVideos: 2,
            timeout: 1.8 * 60 * 1000,
            timeoutMsg: "Expected 2 completed episode videos (no .part files)",
        })

        const episodeBase =
            "我在B站上大学!【完整版-麻省理工-微积分重点】全18讲！学数学不看的微积分课程，看完顺滑一整年。_人工智能数学基础⧸机器学习⧸微积分⧸麻省理工⧸高等数学 p02 2. [oCourse][中英][微积分重点][MIT][Strang]1_微积分总览 [BV1rY4y1P7er_p2]"
        expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, `${episodeBase}.mp4`))).toBe(true)
        expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, `${episodeBase}.png`))).toBe(true)
    })

    it('Download Bilibili Collection', async function () {
        this.timeout(5 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Collection", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        const dvd = DownloadVideoDialogCO
        await dvd.waitForDisplayed()

        expect(dvd.agreementCheckbox).toBeDisplayed()
        await dvd.setAgreement(true)

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.setUrl("https://space.bilibili.com/651386960/lists/1903590?type=season")
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

    it('Download Youtube Video', async function () {
        this.timeout(2 * 60 * 1000)

        const folderPath = await createAndImportFolderViaBrowser({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Youtube Video", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        const dvd = DownloadVideoDialogCO
        await dvd.waitForDisplayed()

        expect(dvd.agreementCheckbox).toBeDisplayed()
        await dvd.setAgreement(true)

        expect(dvd.urlInput).toBeDisplayed()
        await dvd.setUrl("https://www.youtube.com/watch?v=2JgVKe64nl0")
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
