import { join } from "path"
import { existsSync, readdirSync, statSync } from "node:fs"
import { copyAndImportFolder } from "test/actions/import-folders"
import Sidebar from "test/componentobjects/Sidebar"
import { cleanup, setup } from "test/lib/testbed"
import MusicPanel from "test/componentobjects/MusicPanel.co"
import TranscribeDialogCO from "test/componentobjects/TranscribeDialog.co"
import { skipIfOhos, testbedOs } from 'test/lib/e2e-platform'

const videoFolderPath = join(import.meta.dirname, '../../../../test/media/tutorials')
const LOG_PREFIX = "[MusicPanel-Transcribe]"

function logStep(step: string, detail?: Record<string, unknown>) {
    if (detail) {
        console.log(`${LOG_PREFIX} ${step}:`, JSON.stringify(detail))
    } else {
        console.log(`${LOG_PREFIX} ${step}`)
    }
}

async function logMusicPanelState(step: string) {
    await MusicPanel.dumpDebugInfo(step)
}

async function openImportedMusicFolder(folderName: string, minRows: number) {
    await Sidebar.waitForFolderName(folderName)
    logStep("sidebar folder visible", { folderName })
    await Sidebar.clickFolder(folderName)
    logStep("sidebar folder clicked", { folderName })
    await MusicPanel.waitForDataRows(minRows)
    await logMusicPanelState(`after ${minRows} data row(s) visible`)
}

async function confirmTranscribeDialog() {
    await TranscribeDialogCO.waitForDisplayed()
    logStep("transcribe dialog displayed")
    await TranscribeDialogCO.clickConfirm()
    logStep("transcribe dialog confirmed")
}

async function waitForFolderFiles(
    folderPath: string,
    fileNames: string[],
    timeoutMs = 4 * 60 * 1000,
) {
    logStep("waiting for output files", { folderPath, fileNames, timeoutMs })
    await browser.waitUntil(
        () => {
            if (!existsSync(folderPath)) {
                return false
            }
            const files = readdirSync(folderPath)
            return fileNames.every((name) => files.includes(name))
        },
        {
            timeout: timeoutMs,
            interval: 2000,
            timeoutMsg: () => {
                const files = existsSync(folderPath) ? readdirSync(folderPath) : []
                return `[MusicPanel-Transcribe] Timed out waiting for ${fileNames.join(", ")} in ${folderPath}. Found: ${files.join(", ") || "(empty)"}`
            },
        },
    )
    logStep("output files ready", { fileNames })
}

/**
 * Music panel transcribe flows (videocaptioner). Requires `test/media/tutorials/` fixtures.
 *
 * @supports local, Electron
 * @unsupported HarmonyOS
 */
describe('MusicPanel - Transcribe', () => {
    before(function () {
        skipIfOhos(this)
    })


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

    it('Transcribe Single File', async function() {

        this.timeout(5 * 60 * 1000)

        logStep("start", { videoFolderPath, testbedOs })
        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        logStep("folder imported", {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
            path: folder.path,
        })

        await openImportedMusicFolder(folder.folderName, 1)

        await MusicPanel.rightClick(0)
        await MusicPanel.contextMenus.waitForDisplayed()
        logStep("context menu displayed")
        await MusicPanel.clickContextMenuSubtitleItem("transcribe")
        await confirmTranscribeDialog()
        await waitForFolderFiles(folder.path!, ["p1.srt"])
        expect(folder).toContainFile("p1.srt")
    })

    it('Transcribe Multiple Files', async function() {

        this.timeout(5 * 60 * 1000)

        logStep("start multiple files")
        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        logStep("folder imported", {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
        })

        await openImportedMusicFolder(folder.folderName, 2)

        await MusicPanel.selectButton.click()
        await browser.pause(200)
        await logMusicPanelState("after select mode enabled")

        await MusicPanel.click(0)
        await MusicPanel.click(1)
        await logMusicPanelState("after selecting rows 0 and 1")

        await MusicPanel.clickHeaderTranscribe()
        await confirmTranscribeDialog()
        await waitForFolderFiles(folder.path!, ["p1.srt", "p2.srt"])
        expect(folder).toContainFile("p1.srt")
        expect(folder).toContainFile("p2.srt")
    })

    it('Transcribe Multiple Files with partial files', async function() {

        this.timeout(5 * 60 * 1000)

        logStep("start partial selection")
        const folder = await copyAndImportFolder(videoFolderPath, "e2eTest:MusicPanel-Transcribe:Transcribe Single File")
        logStep("folder imported", {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
        })

        await openImportedMusicFolder(folder.folderName, 2)

        await MusicPanel.selectButton.click()
        await browser.pause(200)
        await logMusicPanelState("after select mode enabled")

        await MusicPanel.click(0)
        await MusicPanel.click(1)

        // another click uncheck the first row
        await MusicPanel.click(0)
        await logMusicPanelState("after selecting only row 1")

        await MusicPanel.clickHeaderTranscribe()
        await confirmTranscribeDialog()
        await waitForFolderFiles(folder.path!, ["p2.srt"])
        expect(folder).toContainFile("p2.srt")
    })
})
