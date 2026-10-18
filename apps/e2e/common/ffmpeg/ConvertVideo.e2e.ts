import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import { browser, expect } from '@wdio/globals'
import Sidebar from 'test/componentobjects/Sidebar'
import { cleanup, prepareVideoFile, setup } from 'test/lib/testbed'
import { isDockerE2e, skipIfOhos, testbedOs } from 'test/lib/e2e-platform'
import {
  createAndImportFolderViaBrowser,
  deleteFileViaBrowser,
  fileExistsViaBrowser,
  getFileSizeViaBrowser,
  joinPlatformPath,
  listFileNamesViaBrowser,
} from 'test/lib/browser-fs'

async function waitForFirstTrackRow() {
  await browser.waitUntil(
    async () => {
      const rows = await $$('div[role="table"] > div[role="row"]')
      return (await rows.length) >= 2
    },
    {
      timeout: 30_000,
      interval: 500,
      timeoutMsg: 'Music file table never showed a data row',
    },
  )
}

async function rightClickFirstTrackRow() {
  await browser.waitUntil(
    async () => {
      try {
        const rows = await $$('div[role="table"] > div[role="row"]')
        const dataRow = rows[1]
        if (!dataRow) return false
        await dataRow.scrollIntoView()
        await dataRow.waitForDisplayed({ timeout: 2000 })
        await dataRow.click({ button: 'right' })
        return true
      } catch {
        return false
      }
    },
    {
      timeout: 10_000,
      interval: 500,
      timeoutMsg: 'No data row found in music file table',
    },
  )
}

async function clickContextMenuItem(labels: string[]) {
  await browser.waitUntil(
    async () => {
      for (const label of labels) {
        const item = await $(`[role="menuitem"]=${label}`)
        if (await item.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    {
      timeout: 5000,
      interval: 200,
      timeoutMsg: `Context menu item [${labels.join(', ')}] did not appear`,
    },
  )

  for (const label of labels) {
    const item = await $(`[role="menuitem"]=${label}`)
    if (await item.isDisplayed().catch(() => false)) {
      await item.waitForClickable({ timeout: 3000 })
      await item.click()
      return
    }
  }

  throw new Error(`Context menu item [${labels.join(', ')}] not found`)
}

function checkFfmpegAvailable(): boolean {
  try {
    cp.execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

async function removeConvertOutputs(dir: string) {
  const pattern = /^sample\s*\(\d+\)\.[a-z0-9]+$/i
  if (isDockerE2e) {
    const names = await listFileNamesViaBrowser(dir)
    for (const name of names) {
      if (pattern.test(name)) {
        await deleteFileViaBrowser(joinPlatformPath(dir, name))
      }
    }
    return
  }
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (pattern.test(name)) {
      try {
        fs.unlinkSync(joinPlatformPath(dir, name))
      } catch {
        // best effort
      }
    }
  }
}

async function waitForOutputFile(folderPath: string, fileName: string, timeoutMs: number) {
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
      timeoutMsg: `Converted output never appeared or stayed empty: ${outputPath}`,
    },
  )
  return outputPath
}

const isFfmpegAvailable = isDockerE2e || checkFfmpegAvailable()

if (!isFfmpegAvailable) {
  describe.skip('ConvertVideo - ffmpeg not available in this environment', () => {
    it('skipped', () => {})
  })
} else {
  /**
   * Format conversion via music track context menu (Core FfmpegConvertJob).
   * Defaults-only Start (MP4) — does not switch to WebM.
   *
   * @supports local, Electron, Docker
   * @unsupported HarmonyOS
   */
  describe('ConvertVideo', () => {
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
      if (folderPath) {
        await removeConvertOutputs(folderPath)
      }
      await browser.keys(['\uE00C'])
      await browser.pause(500)
      if (folderPath) {
        await removeConvertOutputs(folderPath)
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
    })

    it('converts sample.mp4 via track context menu (defaults)', async function () {
      this.timeout(10 * 60 * 1000)

      const folderName = `TestConvertVideo-${Date.now()}`
      folderPath = await createAndImportFolderViaBrowser(
        {
          folderName,
          type: 'music',
          files: ['sample.mp4'],
        },
        'e2eTest:ConvertVideo',
      )

      const samplePath = joinPlatformPath(folderPath, 'sample.mp4')
      await prepareVideoFile(samplePath)
      await removeConvertOutputs(folderPath)

      const inputSize = fs.existsSync(samplePath)
        ? fs.statSync(samplePath).size
        : await getFileSizeViaBrowser(samplePath)
      expect(inputSize).toBeGreaterThan(1_000)

      await Sidebar.waitForFolderName(folderName)
      await Sidebar.clickFolder(folderName)
      await waitForFirstTrackRow()
      await browser.pause(1000)

      await rightClickFirstTrackRow()
      await clickContextMenuItem(['Format conversion', '格式转换'])

      const dialog = $('[data-testid="format-converter-dialog"]')
      await dialog.waitForDisplayed({ timeout: 10_000 })

      const fileNameInput = await dialog.$('#format-converter-filename')
      await fileNameInput.waitForDisplayed({ timeout: 5_000 })
      const rawFileName = await fileNameInput.getValue()
      const outputFileName =
        typeof rawFileName === 'string' ? rawFileName.trim() : String(rawFileName ?? '').trim()
      expect(outputFileName).toMatch(/sample\s*\(1\)\.mp4/i)

      const startBtn = await dialog.$('[data-testid="format-converter-start"]')
      await startBtn.waitForClickable({ timeout: 5_000 })
      await startBtn.click()

      await browser.waitUntil(
        async () => {
          const state = await browser.execute(() => {
            const el = document.querySelector('[data-testid="format-converter-dialog"]')
            if (!el) return { closed: true, error: null as string | null }
            const errorEl = el.querySelector('[data-testid="format-converter-error"]')
            const errorText = errorEl?.textContent?.trim() ?? null
            if (errorText) return { closed: false, error: errorText }
            const style = window.getComputedStyle(el)
            const visible =
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              el.getAttribute('data-state') !== 'closed'
            return { closed: !visible, error: null }
          })
          if (state.error) {
            throw new Error(`Format conversion failed: ${state.error}`)
          }
          return state.closed
        },
        {
          timeout: 30_000,
          interval: 200,
          timeoutMsg: 'Format converter dialog did not close after start',
        },
      )

      await waitForOutputFile(folderPath, outputFileName, 8 * 60 * 1000)
    })
  })
}
