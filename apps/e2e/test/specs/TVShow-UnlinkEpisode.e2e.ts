import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EPISODE_FILE_NAME = 'S01E01.mp4'

/** Unlink context menu item text (en and zh-CN). */
const UNLINK_MENU_ITEM_LABELS = ['Unlink', '取消关联']

/** Rename button in TvShowHeader (en and zh-CN) — signals TMDB data is loaded. */
const RENAME_BUTTON_LABELS = ['Rename', '重命名']

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

/**
 * Check if an episode row shows a linked video file (not "-").
 * Returns true if the video cell contains a file path, false if it shows "-".
 */
async function isEpisodeLinkedToVideo(): Promise<boolean> {
  const rowSelector = '//tr[.//td[contains(@class,"font-mono") and normalize-space()="S01E01"]]'
  const row = await $(rowSelector)

  // The video file cell is the second td (after the ID column)
  // It shows the file path if linked, or "-" if not linked
  const videoCell = await row.$('./td[2]')
  const videoCellText = await videoCell.getText()

  // If the cell shows "-", the episode is not linked
  return videoCellText.trim() !== '-'
}

describe('TVShow - Unlink Episode', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('unlinks the video file from the episode via context menu', async function () {
    this.timeout(90 * 1000)

    // 1. Create media folder with the video file
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    fs.writeFileSync(path.join(testMediaFolder, EPISODE_FILE_NAME), '')
    console.log('Created media folder with video file:', testMediaFolder)
    console.log('Files created:', fs.readdirSync(testMediaFolder))

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Unlink Episode',
    })
    await delay(3 * 1000)

    // Wait until TMDB data is loaded (Rename header button becomes visible)
    await waitForRenameButtonDisplayed()
    console.log('TV show panel ready with TMDB data')

    // 2. Wait for episode table to show S01E01 row
    const firstEpisodeRow = await waitForFirstEpisodeRow()
    await delay(500)
    console.log('Episode table ready, S01E01 row visible')

    // 3. Verify the episode is initially linked to a video file
    const initiallyLinked = await isEpisodeLinkedToVideo()
    expect(initiallyLinked).toBe(true)
    console.log('Episode S01E01 is initially linked to video file')

    // 4. Right-click on the episode row to open the context menu
    await firstEpisodeRow.click({ button: 'right' })
    await delay(300)
    console.log('Right-clicked on episode row')

    // 5. Click "Unlink" from the context menu
    await clickContextMenuItem(UNLINK_MENU_ITEM_LABELS)
    await delay(500)
    console.log('Clicked Unlink context menu item')

    // 6. Wait for the UI to update (toast notification and table refresh)
    await delay(1000)

    // 7. Verify the episode is no longer linked to the video file
    const linkedAfterUnlink = await isEpisodeLinkedToVideo()
    expect(linkedAfterUnlink).toBe(false)
    console.log('Episode S01E01 is now unlinked from video file')

    // 8. Verify the video file still exists on disk (unlink doesn't delete the file)
    const filesInMediaFolder = fs.readdirSync(testMediaFolder)
    expect(filesInMediaFolder).toContain(EPISODE_FILE_NAME)
    console.log('Video file still exists on disk after unlink:', EPISODE_FILE_NAME)
  })

  it('disables Unlink menu item when episode has no linked video file', async function () {
    this.timeout(90 * 1000)

    // 1. Create media folder WITHOUT the video file (so no file is linked)
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    // Don't create the video file - the episode will have no linked file
    console.log('Created media folder without video file:', testMediaFolder)

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Unlink Episode - disabled',
    })
    await delay(3 * 1000)

    // Wait until TMDB data is loaded
    await waitForRenameButtonDisplayed()
    console.log('TV show panel ready with TMDB data')

    // 2. Wait for episode table to show S01E01 row
    const firstEpisodeRow = await waitForFirstEpisodeRow()
    await delay(500)
    console.log('Episode table ready, S01E01 row visible')

    // 3. Verify the episode is not linked to any video file
    const initiallyLinked = await isEpisodeLinkedToVideo()
    expect(initiallyLinked).toBe(false)
    console.log('Episode S01E01 is not linked to any video file')

    // 4. Right-click on the episode row to open the context menu
    await firstEpisodeRow.click({ button: 'right' })
    await delay(300)
    console.log('Right-clicked on episode row')

    // 5. Verify the Unlink menu item is disabled
    let unlinkItemDisabled = false
    for (const label of UNLINK_MENU_ITEM_LABELS) {
      const item = await $(`[role="menuitem"]=${label}`)
      if (await item.isDisplayed().catch(() => false)) {
        unlinkItemDisabled = await item.getAttribute('aria-disabled').then(v => v === 'true').catch(() => false)
        if (unlinkItemDisabled) break
      }
    }
    expect(unlinkItemDisabled).toBe(true)
    console.log('Unlink menu item is disabled when episode has no linked video file')
  })
})
