import * as fs from 'node:fs'
import { browser } from '@wdio/globals'
import Sidebar from 'test/componentobjects/Sidebar'
import MusicPanel from 'test/componentobjects/MusicPanel.co'
import TranscribeDialogCO from 'test/componentobjects/TranscribeDialog.co'
import {
  checkVideoCaptionerAvailable,
  cleanup,
  prepareVideoFile,
  setup,
} from 'test/lib/testbed'
import { isDockerE2e, skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import {
  createAndImportFolderViaBrowser,
  fileExistsViaBrowser,
  getFileSizeViaBrowser,
  joinPlatformPath,
} from 'test/lib/browser-fs'

async function waitForSrtFile(folderPath: string, fileName: string, timeoutMs: number) {
  const outputPath = joinPlatformPath(folderPath, fileName)
  await browser.waitUntil(
    async () => {
      try {
        if (isDockerE2e || !fs.existsSync(outputPath)) {
          const exists = await fileExistsViaBrowser(outputPath)
          if (!exists) return false
          const size = await getFileSizeViaBrowser(outputPath)
          return size > 0
        }
        return fs.statSync(outputPath).size > 0
      } catch {
        return false
      }
    },
    {
      timeout: timeoutMs,
      interval: 2_000,
      timeoutMsg: `Transcribe SRT never appeared or stayed empty: ${outputPath}`,
    },
  )
  return outputPath
}

const isVideoCaptionerAvailable = isDockerE2e || checkVideoCaptionerAvailable()

if (!isVideoCaptionerAvailable) {
  describe.skip('Transcribe - videocaptioner not available in this environment', () => {
    it('skipped', () => {})
  })
} else {
  /**
   * Music track context-menu transcribe via VideoCaptioner (`sample.mp4` → `sample.srt`).
   *
   * @supports local, Electron, Docker
   * @unsupported HarmonyOS
   */
  describe('Transcribe', () => {
    before(function () {
      skipIfOhos(this)
    })

    let folderPath: string | undefined

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
    })

    afterEach(async () => {
      await browser.keys(['\uE00C'])
      await browser.pause(500)
      await cleanup({
        removeMetadataDir: true,
        removePlansDir: true,
        removeMediaFolders: true,
        removeDirInSidebar: true,
        resetUserConfig: true,
        clearLocalStorage: true,
        os: testbedOs,
      })
    })

    it('transcribes sample.mp4 via track context menu', async function () {
      this.timeout(10 * 60 * 1000)

      const folderName = `TestTranscribe-${Date.now()}`
      folderPath = await createAndImportFolderViaBrowser(
        {
          folderName,
          type: 'music',
          files: ['sample.mp4'],
        },
        'e2eTest:videocaptioner:Transcribe',
      )

      const samplePath = joinPlatformPath(folderPath, 'sample.mp4')
      await prepareVideoFile(samplePath)

      await Sidebar.waitForFolderName(folderName)
      await Sidebar.clickFolder(folderName)
      await MusicPanel.waitForDataRows(1)
      await browser.pause(1000)

      await MusicPanel.rightClick(0)
      await MusicPanel.contextMenus.waitForDisplayed()
      await MusicPanel.clickContextMenuSubtitleItem('transcribe')

      await TranscribeDialogCO.waitForDisplayed()
      await TranscribeDialogCO.clickConfirm()

      await waitForSrtFile(folderPath, 'sample.srt', 10 * 60 * 1000)
    })
  })
}
