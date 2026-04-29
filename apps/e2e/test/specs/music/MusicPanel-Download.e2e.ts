import { createAndImportFolder } from "test/actions/import-folders"
import { cleanup, setup } from "test/lib/testbed"
import MusicPanel from "test/componentobjects/MusicPanel.co"
import DownloadVideoDialogCO from "test/componentobjects/DownloadVideoDialog.co"
import { readdirSync } from "fs"

describe('MusicPanel - Download', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })
  
    afterEach(async () => {
        // await cleanup({
        //     removeMetadataDir: true,
        //     removePlansDir: true,
        //     removeMediaFolders: true,
        //     removeDirInSidebar: true,
        //     resetUserConfig: true,
        //     clearLocalStorage: true,
        // })
    })

    it('Download Bilibili Video', async function() {
        this.timeout(60000);

        const folder = await createAndImportFolder({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Video")

        await MusicPanel.downloadButton.waitForExist();
        await MusicPanel.downloadButton.waitForStable();
        await MusicPanel.downloadButton.waitForClickable();
        await MusicPanel.downloadButton.click();

        const dvd = DownloadVideoDialogCO;
        await dvd.waitForDisplayed();

        expect(dvd.agreementCheckbox).toBeDisplayed();
        await dvd.setAgreement(true);

        expect(dvd.episodesCheckbox).not.toBeDisplayed();

        expect(dvd.urlInput).toBeDisplayed();
        await dvd.setUrl("https://www.bilibili.com/video/BV17NrWBaE87/");
        await dvd.clickStart();

        await browser.waitUntil(async () => {
            const files = readdirSync(folder.path!)
            return files.length > 0
        }, {
            timeout: 10000,
            timeoutMsg: "No files in folder",
            interval: 1000,
        })

        expect(folder).toContainFile("ピノキオピー - 不死身ごっこ feat. 初音ミク [BV17NrWBaE87].jpg")
        expect(folder).toContainFile("ピノキオピー - 不死身ごっこ feat. 初音ミク [BV17NrWBaE87].mp4")
    })

    it('Download Bilibili Episodes', async function() {
        this.timeout(2 * 60 * 1000);

        const folder = await createAndImportFolder({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Bilibili Episodes")

        await MusicPanel.downloadButton.waitForExist();
        await MusicPanel.downloadButton.waitForStable();
        await MusicPanel.downloadButton.waitForClickable();
        await MusicPanel.downloadButton.click();

        const dvd = DownloadVideoDialogCO;
        await dvd.waitForDisplayed();

        expect(dvd.agreementCheckbox).toBeDisplayed();
        await dvd.setAgreement(true);

        expect(dvd.urlInput).toBeDisplayed();
        await dvd.setUrl("https://www.bilibili.com/video/BV1rY4y1P7er/");

        expect(dvd.episodesCheckbox).toBeDisplayed();
        await dvd.setDownloadEpisodes(true);

        await browser.waitUntil(async () => {
            const list = await dvd.episodesListItems;
            return (await list.length) === 18;
        }, {
            timeout: 60 * 1000,
            interval: 1000,
        }) 

        await dvd.uncheckEpisodesExcept([0, 1])
        await dvd.dumpStartButtonDebugInfo()

        await dvd.clickStart();

        await browser.waitUntil(async () => {
            const files = readdirSync(folder.path!)
            return files.length >= 2
        }, {
            timeout:  1.8 * 60 * 1000,
            timeoutMsg: "No files in folder",
            interval: 1000,
        })

        expect(folder).toContainFile("我在B站上大学!【完整版-麻省理工-微积分重点】全18讲！学数学不看的微积分课程，看完顺滑一整年。_人工智能数学基础⧸机器学习⧸微积分⧸麻省理工⧸高等数学 p02 2. [oCourse][中英][微积分重点][MIT][Strang]1_微积分总览 [BV1rY4y1P7er_p2].mp4")
        expect(folder).toContainFile("我在B站上大学!【完整版-麻省理工-微积分重点】全18讲！学数学不看的微积分课程，看完顺滑一整年。_人工智能数学基础⧸机器学习⧸微积分⧸麻省理工⧸高等数学 p02 2. [oCourse][中英][微积分重点][MIT][Strang]1_微积分总览 [BV1rY4y1P7er_p2].png")
    })

    it('Download Youtube Video', async function() {
        this.timeout(2 * 60 * 1000);

        const folder = await createAndImportFolder({
            folderName: "BilibiliMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download:Download Youtube Video")

        await MusicPanel.downloadButton.waitForExist();
        await MusicPanel.downloadButton.waitForStable();
        await MusicPanel.downloadButton.waitForClickable();
        await MusicPanel.downloadButton.click();

        const dvd = DownloadVideoDialogCO;
        await dvd.waitForDisplayed();

        expect(dvd.agreementCheckbox).toBeDisplayed();
        await dvd.setAgreement(true);

        expect(dvd.urlInput).toBeDisplayed();
        await dvd.setUrl("https://www.youtube.com/watch?v=2JgVKe64nl0");
        await dvd.clickStart();

        await browser.waitUntil(async () => {
            const files = readdirSync(folder.path!)
            return files.length >= 2
        }, {
            timeout: 1.8 * 60 * 1000,
            timeoutMsg: "No files in folder",
            interval: 1000,
        })

        expect(folder).toContainFile("【宇宙雜談】重大發現！W玻色子超重嚴重？希格斯機制遇到大問題？｜ Linvo說宇宙 [2JgVKe64nl0].mkv")
        expect(folder).toContainFile("【宇宙雜談】重大發現！W玻色子超重嚴重？希格斯機制遇到大問題？｜ Linvo說宇宙 [2JgVKe64nl0].webp")
    })
})
