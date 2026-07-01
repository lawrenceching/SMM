import { join } from "path"
import { existsSync, statSync } from "node:fs"
import { copyAndImportFolder } from "test/actions/import-folders"
import Sidebar from "test/componentobjects/Sidebar"
import { cleanup, setup } from "test/lib/testbed"
import MusicPanel from "test/componentobjects/MusicPanel.co"
const videoFolderPath = join(import.meta.dirname, '../../../../../test/media/tutorials')

describe('MusicPanel - Transcribe', () => {

    before(async () => {
        // In this test case
        // The video folder requires real video files, which cannot be committed to git repo.
        // Developer needs to manually setup the "videoFolderPath" folder for testing.
        if (!existsSync(videoFolderPath)) {
            throw new Error(
                `[MusicPanel-Transcribe] Required test media folder does not exist: ${videoFolderPath}. ` +
                `Please create this folder and put sample video files in it (e.g. p1.mp4, p2.mp4).`,
            )
        }

        if (!statSync(videoFolderPath).isDirectory()) {
            throw new Error(
                `[MusicPanel-Transcribe] Expected a directory but got a non-directory path: ${videoFolderPath}`,
            )
        }
    })

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

    it('Transcribe Single File', async function() {

        this.timeout(60 * 1000)

        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        await Sidebar.waitForFolderName(folder.folderName)

        await browser.pause(5000)

        await MusicPanel.rightClick(0)
        await MusicPanel.contextMenus.waitForDisplayed()
        await MusicPanel.clickContextMenu("transcribe")
        await browser.pause(50 * 1000)
        expect(folder).toContainFile("p1.srt")
    })

    it('Transcribe Multiple Files', async function() {

        this.timeout(2 * 60 * 1000)

        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        await Sidebar.waitForFolderName(folder.folderName)

        await browser.pause(5000)

        await expect(MusicPanel.transcribeButton).toBeDisabled()

        await MusicPanel.selectButton.click()
        await browser.pause(200)

        await MusicPanel.click(0)
        await MusicPanel.click(1)

        await MusicPanel.transcribeButton.click()
        await browser.pause(1.5 * 60 * 1000)
        expect(folder).toContainFile("p1.srt")
        expect(folder).toContainFile("p2.srt")
    })

    it('Transcribe Multiple Files with partial files', async function() {

        this.timeout(1 * 60 * 1000)

        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        await Sidebar.waitForFolderName(folder.folderName)

        await browser.pause(5000)

        await expect(MusicPanel.transcribeButton).toBeDisabled()

        await MusicPanel.selectButton.click()
        await browser.pause(200)

        await MusicPanel.click(0)
        await MusicPanel.click(1)

        // another click uncheck the first row
        await MusicPanel.click(0)

        await MusicPanel.transcribeButton.click()
        await browser.pause(50 * 1000)
        expect(folder).toContainFile("p2.srt")
    })
})
