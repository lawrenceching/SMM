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
  listFileNamesViaBrowser,
} from 'test/lib/browser-fs'

/** Prefer non-empty `sample.srt`, else any non-empty `.srt` (log dir on failure). */
async function waitForNonEmptySrt(folderPath: string, timeoutMs: number) {
  const preferred = 'sample.srt'
  try {
    await browser.waitUntil(
      async () => {
        try {
          const preferredPath = joinPlatformPath(folderPath, preferred)
          if (isDockerE2e || !fs.existsSync(preferredPath)) {
            if (await fileExistsViaBrowser(preferredPath)) {
              if ((await getFileSizeViaBrowser(preferredPath)) > 0) return true
            }
          } else if (fs.statSync(preferredPath).size > 0) {
            return true
          }

          if (isDockerE2e || !fs.existsSync(folderPath)) {
            const names = await listFileNamesViaBrowser(folderPath)
            for (const name of names) {
              if (!name.toLowerCase().endsWith('.srt')) continue
              const size = await getFileSizeViaBrowser(joinPlatformPath(folderPath, name))
              if (size > 0) return true
            }
            return false
          }
          return fs.readdirSync(folderPath).some((n) => {
            if (!n.toLowerCase().endsWith('.srt')) return false
            return fs.statSync(joinPlatformPath(folderPath, n)).size > 0
          })
        } catch {
          return false
        }
      },
      {
        timeout: timeoutMs,
        interval: 2_000,
        timeoutMsg: `Transcribe never produced a non-empty .srt under ${folderPath}`,
      },
    )
  } catch (err) {
    let listing: string[]
    try {
      listing =
        isDockerE2e || !fs.existsSync(folderPath)
          ? await listFileNamesViaBrowser(folderPath)
          : fs.readdirSync(folderPath)
    } catch {
      listing = ['(failed to list)']
    }
    console.error('dir:', listing)
    throw err
  }
}

const isVideoCaptionerAvailable = isDockerE2e || checkVideoCaptionerAvailable()

if (!isVideoCaptionerAvailable) {
  describe.skip('Transcribe - videocaptioner not available in this environment', () => {
    it('skipped', () => {})
  })
} else {
  /**
   * Music track context-menu transcribe via VideoCaptioner (`sample.mp4` → non-empty `.srt`).
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
      this.timeout(12 * 60 * 1000)

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

      await waitForNonEmptySrt(folderPath, 8 * 60 * 1000)
    })
  })
}
