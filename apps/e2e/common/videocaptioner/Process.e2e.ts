import * as fs from 'node:fs'
import { browser } from '@wdio/globals'
import Sidebar from 'test/componentobjects/Sidebar'
import MusicPanel from 'test/componentobjects/MusicPanel.co'
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
      timeoutMsg: `Process SRT never appeared or stayed empty: ${outputPath}`,
    },
  )
  return outputPath
}

const isVideoCaptionerAvailable = isDockerE2e || checkVideoCaptionerAvailable()

if (!isVideoCaptionerAvailable) {
  describe.skip('Process - videocaptioner not available in this environment', () => {
    it('skipped', () => {})
  })
} else {
  /**
   * Music header Process via VideoCaptioner short path (`sample.mp4` → `sample.srt`).
   * Checks noTranslate so Confirm does not require target language / translator.
   *
   * @supports local, Electron, Docker
   * @unsupported HarmonyOS
   */
  describe('Process', () => {
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

    it('processes sample.mp4 via music header Process (noTranslate short path)', async function () {
      this.timeout(10 * 60 * 1000)

      const folderName = `TestProcess-${Date.now()}`
      folderPath = await createAndImportFolderViaBrowser(
        {
          folderName,
          type: 'music',
          files: ['sample.mp4'],
        },
        'e2eTest:videocaptioner:Process',
      )

      const samplePath = joinPlatformPath(folderPath, 'sample.mp4')
      await prepareVideoFile(samplePath)

      await Sidebar.waitForFolderName(folderName)
      await Sidebar.clickFolder(folderName)
      await MusicPanel.waitForDataRows(1)
      await browser.pause(1000)

      await MusicPanel.clickHeaderProcess()

      const dialog = await $('[data-testid="process-pipeline-dialog"]')
      await dialog.waitForDisplayed({ timeout: 10_000 })

      const noTranslate = await $('[data-testid="process-pipeline-no-translate"]')
      await noTranslate.waitForExist({ timeout: 5000 })
      if (!(await noTranslate.isSelected())) {
        await noTranslate.click()
      }

      const confirm = await $('[data-testid="process-pipeline-confirm"]')
      await confirm.waitForClickable({ timeout: 5000 })
      await confirm.click()

      await waitForSrtFile(folderPath, 'sample.srt', 10 * 60 * 1000)
    })
  })
}
