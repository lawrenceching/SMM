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
  basenamePlatformPath,
  createAndImportFolderViaBrowser,
  joinPlatformPath,
  listFilesViaBrowser,
} from 'test/lib/browser-fs'
import { prepareMinimalSrt } from 'test/lib/prepareMinimalSrt'

const VIDEO_EXT = /\.(mp4|mkv|webm|mov)$/i

async function snapshotVideoMtimes(folderPath: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (isDockerE2e || !fs.existsSync(folderPath)) {
    const items = await listFilesViaBrowser(folderPath)
    for (const item of items) {
      if (item.isDirectory) continue
      const name = basenamePlatformPath(item.path)
      if (VIDEO_EXT.test(name)) {
        map.set(name, item.mtime)
      }
    }
    return map
  }
  for (const name of fs.readdirSync(folderPath)) {
    if (VIDEO_EXT.test(name)) {
      map.set(name, fs.statSync(joinPlatformPath(folderPath, name)).mtimeMs)
    }
  }
  return map
}

async function waitForVideoChangedOrNew(
  folderPath: string,
  before: Map<string, number>,
  timeoutMs: number,
) {
  await browser.waitUntil(
    async () => {
      try {
        if (isDockerE2e || !fs.existsSync(folderPath)) {
          const items = await listFilesViaBrowser(folderPath)
          return items.some((item) => {
            if (item.isDirectory) return false
            const name = basenamePlatformPath(item.path)
            if (!VIDEO_EXT.test(name)) return false
            if (item.size <= 0) return false
            const prev = before.get(name)
            return prev === undefined || item.mtime > prev
          })
        }
        const afterNames = fs.readdirSync(folderPath).filter((n) => VIDEO_EXT.test(n))
        return afterNames.some((n) => {
          const full = joinPlatformPath(folderPath, n)
          const size = fs.statSync(full).size
          if (size <= 0) return false
          const prev = before.get(n)
          return prev === undefined || fs.statSync(full).mtimeMs > prev
        })
      } catch {
        return false
      }
    },
    {
      timeout: timeoutMs,
      interval: 2_000,
      timeoutMsg: `Synthesize never produced a new/changed non-empty video under ${folderPath}`,
    },
  )
}

const isVideoCaptionerAvailable = isDockerE2e || checkVideoCaptionerAvailable()

if (!isVideoCaptionerAvailable) {
  describe.skip('Synthesize - videocaptioner not available in this environment', () => {
    it('skipped', () => {})
  })
} else {
  /**
   * Music header Synthesize via VideoCaptioner (`sample.mp4` + `sample.srt`).
   *
   * @supports local, Electron, Docker
   * @unsupported HarmonyOS
   */
  describe('Synthesize', () => {
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

    it('synthesizes video via music header Synthesize', async function () {
      this.timeout(10 * 60 * 1000)

      const folderName = `TestSynthesize-${Date.now()}`
      folderPath = await createAndImportFolderViaBrowser(
        {
          folderName,
          type: 'music',
          files: ['sample.mp4', 'sample.srt'],
        },
        'e2eTest:videocaptioner:Synthesize',
      )

      const sampleMp4Path = joinPlatformPath(folderPath, 'sample.mp4')
      const sampleSrtPath = joinPlatformPath(folderPath, 'sample.srt')
      await prepareVideoFile(sampleMp4Path)
      prepareMinimalSrt(sampleSrtPath)

      await Sidebar.waitForFolderName(folderName)
      await Sidebar.clickFolder(folderName)
      await MusicPanel.waitForDataRows(1)
      await browser.pause(1000)

      await MusicPanel.clickHeaderSynthesize()

      const dialog = await $('[data-testid="synthesize-subtitle-dialog"]')
      await dialog.waitForDisplayed({ timeout: 10_000 })

      const before = await snapshotVideoMtimes(folderPath)

      const confirm = await $('[data-testid="synthesize-subtitle-dialog-confirm"]')
      await confirm.waitForClickable({ timeout: 5000 })
      await confirm.click()

      await waitForVideoChangedOrNew(folderPath, before, 10 * 60 * 1000)
    })
  })
}
