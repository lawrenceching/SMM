import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import RenameDialog from '../componentobjects/RenameDialog'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EPISODE_FILE_NAME = 'S01E01.mp4'
const RENAMED_FILE_NAME = 'S01E01_renamed.mp4'

/**
 * Associated files that share the same stem as the episode video.
 * These are created alongside the video and must all be renamed implicitly
 * when the video file is renamed via context menu.
 *
 * Pattern examples:
 *   S01E01.srt         → exact stem match
 *   S01E01.en.srt      → stem + language tag suffix
 *   S01E01.ass         → stem + different subtitle extension
 */
const ASSOCIATED_FILES = ['S01E01.srt', 'S01E01.en.srt', 'S01E01.ass'] as const
/** Expected names after rename (stem swapped, rest preserved). */
const RENAMED_ASSOCIATED_FILES = ['S01E01_renamed.srt', 'S01E01_renamed.en.srt', 'S01E01_renamed.ass'] as const

/** Rename button in TvShowHeader (en and zh-CN) — signals TMDB data is loaded. */
const RENAME_BUTTON_LABELS = ['Rename', '重命名']

/** Rename context menu item text (en and zh-CN). */
const RENAME_MENU_ITEM_LABELS = ['Rename', '重命名']

async function waitForRenameButtonDisplayed() {
  await browser.waitUntil(
    async () => {
      for (const label of RENAME_BUTTON_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 30000, interval: 500, timeoutMsg: 'Rename button did not appear in TV show header' }
  )
}

/**
 * Wait for the episode table (TvShowEpisodeTable) to show the first episode row (S01E01)
 * and return that row element for later use (e.g. right-click to open context menu).
 * No "expand season" step needed — the table shows all episodes by default.
 */
async function waitForFirstEpisodeRow() {
  const rowSelector = '//tr[.//td[contains(@class,"font-mono") and normalize-space()="S01E01"]]'
  await browser.waitUntil(
    async () => {
      const row = await $(rowSelector)
      return await row.isDisplayed().catch(() => false)
    },
    { timeout: 10000, interval: 300, timeoutMsg: 'Episode table did not show S01E01 after TMDB data loaded' }
  )
  const row = await $(rowSelector)
  if (!row) throw new Error('Could not find episode row for S01E01')
  return row
}

/**
 * Wait for a context menu item with the given labels and click it.
 */
async function clickContextMenuItem(labels: string[]) {
  await browser.waitUntil(
    async () => {
      for (const label of labels) {
        const item = await $(`[role="menuitem"]=${label}`)
        if (await item.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 5000, interval: 200, timeoutMsg: `Context menu item [${labels.join(', ')}] did not appear` }
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

describe('TVShow - Rename Episode File', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('renames the video file and its associated files (subtitles, etc.) via context menu', async function () {
    this.timeout(90 * 1000)

    // 1. Create media folder with the video file and associated files sharing the same stem
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    fs.writeFileSync(path.join(testMediaFolder, EPISODE_FILE_NAME), '')
    for (const assoc of ASSOCIATED_FILES) {
      fs.writeFileSync(path.join(testMediaFolder, assoc), '')
    }
    console.log('Created media folder with video + associated files:', testMediaFolder)
    console.log('Files created:', fs.readdirSync(testMediaFolder))

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Rename Episode File',
    })
    await delay(3 * 1000)

    // Wait until TMDB data is loaded (Rename header button becomes visible)
    await waitForRenameButtonDisplayed()
    console.log('TV show panel ready with TMDB data')

    // 2. Wait for episode table to show S01E01 row (no season expand needed with TvShowEpisodeTable)
    const firstEpisodeRow = await waitForFirstEpisodeRow()
    await delay(500)
    console.log('Episode table ready, S01E01 row visible')

    // 3. Right-click on the episode row to open the context menu (video file is in the row; menu is on whole row)
    await firstEpisodeRow.click({ button: 'right' })
    await delay(300)
    console.log('Right-clicked on episode row')

    // 4. Click "Rename" from the context menu
    await clickContextMenuItem(RENAME_MENU_ITEM_LABELS)
    await delay(300)
    console.log('Clicked Rename context menu item')

    // 5. Rename dialog should open with the current file name pre-filled
    const dialogDisplayed = await RenameDialog.waitForDisplayed(5000)
    expect(dialogDisplayed).toBe(true)
    const inputValue = await RenameDialog.getInputValue()
    expect(inputValue).toBe(EPISODE_FILE_NAME)
    console.log('Rename dialog shown with initial value:', inputValue)

    // 6. Confirm button should be disabled while name is unchanged
    expect(await RenameDialog.isConfirmDisabled()).toBe(true)
    console.log('Confirm button is disabled when name is unchanged (expected)')

    // 7. Enter the new file name
    await RenameDialog.setInputValue(RENAMED_FILE_NAME)
    expect(await RenameDialog.getInputValue()).toBe(RENAMED_FILE_NAME)
    expect(await RenameDialog.isConfirmDisabled()).toBe(false)
    console.log('Confirm button is enabled after name change (expected)')

    // 8. Confirm the rename
    await RenameDialog.clickConfirm()
    await RenameDialog.waitForClosed()
    console.log('Rename dialog closed after confirm')

    // Allow time for the batch file system rename to complete
    await delay(2000)

    const filesInMediaFolder = fs.readdirSync(testMediaFolder)
    console.log('Files in media folder after rename:', filesInMediaFolder)

    // 9. Assert the video file was renamed
    expect(filesInMediaFolder).toContain(RENAMED_FILE_NAME)
    expect(filesInMediaFolder).not.toContain(EPISODE_FILE_NAME)
    console.log(`Video renamed: "${EPISODE_FILE_NAME}" -> "${RENAMED_FILE_NAME}"`)

    // 10. Assert every associated file was renamed implicitly with the new stem
    for (let i = 0; i < ASSOCIATED_FILES.length; i++) {
      const original = ASSOCIATED_FILES[i]!
      const renamed = RENAMED_ASSOCIATED_FILES[i]!
      expect(filesInMediaFolder).toContain(renamed)
      expect(filesInMediaFolder).not.toContain(original)
      console.log(`Associated file renamed implicitly: "${original}" -> "${renamed}"`)
    }
  })
})
