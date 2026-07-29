import { expect, browser } from '@wdio/globals'
import { copyAndImportFolder } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { cleanup, setup } from 'test/lib/testbed'
import MusicPanel from 'test/componentobjects/MusicPanel.co'
import TranscribeDialogCO from 'test/componentobjects/TranscribeDialog.co'
import { isDockerE2e, skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import {
    assertTutorialFixturesForCurrentPlatform,
    copyTutorialsAndImportMusicFolder,
    E2E_TUTORIAL_HOST_DIR,
    waitForFolderFileNames,
} from 'test/lib/e2e-tutorial-fixtures'
import { listFileNamesViaBrowser } from 'test/lib/browser-fs'

const LOG_PREFIX = '[MusicPanel-Transcribe]'

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
    logStep('sidebar folder visible', { folderName })
    await Sidebar.clickFolder(folderName)
    logStep('sidebar folder clicked', { folderName })
    await MusicPanel.waitForDataRows(minRows)
    await logMusicPanelState(`after ${minRows} data row(s) visible`)
}

async function confirmTranscribeDialog() {
    await TranscribeDialogCO.waitForDisplayed()
    logStep('transcribe dialog displayed')
    await TranscribeDialogCO.clickConfirm()
    logStep('transcribe dialog confirmed')
}

async function importTutorialMusicFolder(traceId: string) {
    if (isDockerE2e) {
        return copyTutorialsAndImportMusicFolder(traceId)
    }
    return copyAndImportFolder(E2E_TUTORIAL_HOST_DIR, traceId)
}

async function expectFolderContainsFile(folderPath: string, fileName: string) {
    const names = await listFileNamesViaBrowser(folderPath)
    expect(names).toContain(fileName)
}

/**
 * Music panel transcribe flows (videocaptioner). Requires `test/media/tutorials/` fixtures.
 *
 * @supports local, Electron
 * @unsupported HarmonyOS, Docker
 */
describe('MusicPanel - Transcribe', () => {
    before(function () {
        skipIfOhos(this)
    })

    before(async () => {
        assertTutorialFixturesForCurrentPlatform()
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

    it('Transcribe Single File', async function () {
        this.timeout(5 * 60 * 1000)

        logStep('start', { testbedOs, docker: isDockerE2e })
        const folder = await importTutorialMusicFolder(
            'e2eTest:MusicPanel-Transcribe:Transcribe Single File',
        )
        logStep('folder imported', {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
            path: folder.path,
        })

        await openImportedMusicFolder(folder.folderName, 1)

        await MusicPanel.rightClick(0)
        await MusicPanel.contextMenus.waitForDisplayed()
        logStep('context menu displayed')
        await MusicPanel.clickContextMenuSubtitleItem('transcribe')
        await confirmTranscribeDialog()
        await waitForFolderFileNames(folder.path!, ['p1.srt'])
        await expectFolderContainsFile(folder.path!, 'p1.srt')
    })

    it('Transcribe Multiple Files', async function () {
        this.timeout(5 * 60 * 1000)

        logStep('start multiple files')
        const folder = await importTutorialMusicFolder(
            'e2eTest:MusicPanel-Transcribe:Transcribe Multiple Files',
        )
        logStep('folder imported', {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
        })

        await openImportedMusicFolder(folder.folderName, 2)

        await MusicPanel.selectButton.click()
        await browser.pause(200)
        await logMusicPanelState('after select mode enabled')

        await MusicPanel.click(0)
        await MusicPanel.click(1)
        await logMusicPanelState('after selecting rows 0 and 1')

        await MusicPanel.clickHeaderTranscribe()
        await confirmTranscribeDialog()
        await waitForFolderFileNames(folder.path!, ['p1.srt', 'p2.srt'])
        await expectFolderContainsFile(folder.path!, 'p1.srt')
        await expectFolderContainsFile(folder.path!, 'p2.srt')
    })

    it('Transcribe Multiple Files with partial files', async function () {
        this.timeout(5 * 60 * 1000)

        logStep('start partial selection')
        const folder = await importTutorialMusicFolder(
            'e2eTest:MusicPanel-Transcribe:Transcribe partial',
        )
        logStep('folder imported', {
            folderName: folder.folderName,
            fileCount: folder.files.length,
            files: folder.files,
        })

        await openImportedMusicFolder(folder.folderName, 2)

        await MusicPanel.selectButton.click()
        await browser.pause(200)
        await logMusicPanelState('after select mode enabled')

        await MusicPanel.click(0)
        await MusicPanel.click(1)

        // another click uncheck the first row
        await MusicPanel.click(0)
        await logMusicPanelState('after selecting only row 1')

        await MusicPanel.clickHeaderTranscribe()
        await confirmTranscribeDialog()
        await waitForFolderFileNames(folder.path!, ['p2.srt'])
        await expectFolderContainsFile(folder.path!, 'p2.srt')
    })
})
