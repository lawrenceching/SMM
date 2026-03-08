import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import RenameDialog from '../componentobjects/RenameDialog'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

// Movie folder with TMDB ID so the app loads TMDB data and shows the movie panel with Files section
const FOLDER_NAME = '哪吒之魔童降世 (2019) {tmdbid=552524}'
const VIDEO_FILE_NAME = 'movie.mp4'
const RENAMED_FILE_NAME = 'movie_renamed.mp4'

/**
 * Associated files that share the same stem as the movie video.
 * Renamed implicitly when the video file is renamed via context menu.
 */
const ASSOCIATED_FILES = ['movie.srt', 'movie.en.srt', 'movie.ass'] as const
const RENAMED_ASSOCIATED_FILES = ['movie_renamed.srt', 'movie_renamed.en.srt', 'movie_renamed.ass'] as const

/** Rename button in movie overview header (en and zh-CN) — signals TMDB data and Files section are ready. */
const RENAME_BUTTON_LABELS = ['Rename', '重命名']

/** Rename context menu item text (en and zh-CN). */
const RENAME_MENU_ITEM_LABELS = ['Rename', '重命名']

/** Sidebar displays folder basename for movie (AppV2 mediaName fallback). */
const SIDEBAR_FOLDER_DISPLAY_NAME = FOLDER_NAME

async function waitForMoviePanelRenameButtonDisplayed() {
  await browser.waitUntil(
    async () => {
      for (const label of RENAME_BUTTON_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 30000, interval: 500, timeoutMsg: 'Rename button did not appear in movie overview' }
  )
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

describe('Movie - Rename Video File', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('renames the video file and its associated files (subtitles, etc.) via context menu', async function () {
    this.timeout(90 * 1000)

    // 1. Create movie folder with video and associated files sharing the same stem
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    fs.writeFileSync(path.join(testMediaFolder, VIDEO_FILE_NAME), '')
    for (const assoc of ASSOCIATED_FILES) {
      fs.writeFileSync(path.join(testMediaFolder, assoc), '')
    }
    console.log('Created movie folder with video + associated files:', testMediaFolder)
    console.log('Files created:', fs.readdirSync(testMediaFolder))

    await Menu.importMediaFolder({
      type: 'movie',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:Movie Rename Video File',
    })
    await delay(3 * 1000)

    // Wait for folder to appear in sidebar and select it (display name is movie title when tmdbid in path)
    const folderDisplayed = await Sidebar.waitForFolder(SIDEBAR_FOLDER_DISPLAY_NAME, 30000)
    expect(folderDisplayed).toBe(true)
    await Sidebar.clickFolder(SIDEBAR_FOLDER_DISPLAY_NAME)
    await delay(1000)

    // Wait until movie panel is ready (Rename button in overview visible)
    await waitForMoviePanelRenameButtonDisplayed()
    console.log('Movie panel ready with TMDB data')

    // 2. Wait for Files section and the video file row to be visible
    await browser.waitUntil(
      async () => {
        const fileRows = await $$('p.font-mono.font-medium.text-sm')
        for (const el of fileRows) {
          const text = (await el.getText()).trim()
          if (text === VIDEO_FILE_NAME) return true
        }
        return false
      },
      { timeout: 10000, interval: 300, timeoutMsg: 'Video file row did not appear in Movie Files section' }
    )

    // 3. Right-click on the video file name to open the context menu
    const videoFileParagraph = await $(`//p[contains(@class,"font-mono") and contains(@class,"font-medium") and normalize-space(text())="${VIDEO_FILE_NAME}"]`)
    await videoFileParagraph.waitForDisplayed({ timeout: 5000 })
    await videoFileParagraph.click({ button: 'right' })
    await delay(300)
    console.log('Right-clicked on movie video file element')

    // 4. Click "Rename" from the context menu
    await clickContextMenuItem(RENAME_MENU_ITEM_LABELS)
    await delay(300)
    console.log('Clicked Rename context menu item')

    // 5. Rename dialog should open with the current file name pre-filled
    const dialogDisplayed = await RenameDialog.waitForDisplayed(5000)
    expect(dialogDisplayed).toBe(true)
    const inputValue = await RenameDialog.getInputValue()
    expect(inputValue).toBe(VIDEO_FILE_NAME)
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
    expect(filesInMediaFolder).not.toContain(VIDEO_FILE_NAME)
    console.log(`Video renamed: "${VIDEO_FILE_NAME}" -> "${RENAMED_FILE_NAME}"`)

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
