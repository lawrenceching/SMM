import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EXPECTED_SHOW_TITLE = '天使降临到我身边！'
const PREFIX_E01 = '天使降临到我身边！ - S01E01 - '
const PREFIX_E02 = '天使降临到我身边！ - S01E02 - '
const EXTENSIONS = ['.mp4', '.ass', '.jpg', '.mka', '.nfo']
const SEASON_01_FOLDER = 'Season 01'


/** Confirm button labels (en and zh-CN). */
const CONFIRM_LABELS = ['Confirm', '确认']

/** Rename button in TvShowHeader (en and zh-CN). */
const RENAME_BUTTON_LABELS = ['Rename', '重命名']

/** Recognize button in TvShowHeader (en and zh-CN). */
const RECOGNIZE_BUTTON_LABELS = ['Recognize', '识别']

/**
 * Click the Confirm button in the visible floating prompt.
 * Waits for the Confirm button to appear (prompt opens after folder is selected and TMDB is fetched).
 * Tries both en and zh-CN labels.
 */
async function clickFloatingPromptConfirm() {
  await browser.waitUntil(
    async () => {
      for (const label of CONFIRM_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 20000, interval: 500, timeoutMsg: 'Floating prompt Confirm button did not appear' }
  )
  let confirmBtn = await $('button=Confirm')
  if (!(await confirmBtn.isDisplayed().catch(() => false))) {
    confirmBtn = await $('button=确认')
  }
  await confirmBtn.waitForClickable({ timeout: 5000 })
  await confirmBtn.click()
}

/**
 * Wait for the Rename button in the TV show header to be displayed.
 * Tries both en and zh-CN labels.
 */
async function waitForRenameButtonDisplayed() {
  await browser.waitUntil(
    async () => {
      for (const label of RENAME_BUTTON_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 20000, interval: 500, timeoutMsg: 'Rename button did not appear in TV show header' }
  )
}

/**
 * Click the Rename button in the TV show header.
 */
async function clickRenameButton() {
  for (const label of RENAME_BUTTON_LABELS) {
    const b = await $(`button=${label}`)
    if (await b.isDisplayed().catch(() => false)) {
      await b.waitForClickable({ timeout: 5000 })
      await b.click()
      return
    }
  }
  throw new Error('Rename button did not appear in TV show header')
}

/**
 * Click the Recognize button in the TV show header.
 */
async function clickRecognizeButton() {
  for (const label of RECOGNIZE_BUTTON_LABELS) {
    const b = await $(`button=${label}`)
    if (await b.isDisplayed().catch(() => false)) {
      await b.waitForClickable({ timeout: 5000 })
      await b.click()
      return
    }
  }
  throw new Error('Recognize button did not appear in TV show header')
}

describe('TVShow - Rename Episodes By Rule', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  // afterEach(async () => {
  //   if (fs.existsSync(tmpMediaRoot)) {
  //     fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
  //     console.log('Removed tmp media folder:', tmpMediaRoot)
  //   }
  // })

  it.only('renames S01E01/S01E02 files, renames by rule, and shows new names in UI', async function () {
    this.timeout(90 * 1000)

    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    for (const ep of ['S01E01', 'S01E02']) {
      for (const ext of EXTENSIONS) {
        const filePath = path.join(testMediaFolder, `${ep}${ext}`)
        fs.writeFileSync(filePath, '')
      }
    }
    console.log('Created media folder with episode files:', testMediaFolder)

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Rename Episodes By Rule',
    })
    await delay(3 * 1000)

    await waitForRenameButtonDisplayed()

    // 3. Open Rename prompt and confirm (default Plex rule)
    await clickRenameButton()
    await delay(500)
    await clickFloatingPromptConfirm()
    await delay(5000)

    // 4. Assert "Season 01" folder was created and files were renamed inside it
    const season01Path = path.join(testMediaFolder, SEASON_01_FOLDER)
    const topLevelEntries = fs.readdirSync(testMediaFolder)
    console.log('Media folder path:', testMediaFolder)
    console.log('Entries in media folder (before Season 01 check):', topLevelEntries)
    console.log('Season 01 path:', season01Path, 'exists:', fs.existsSync(season01Path))
    if (fs.existsSync(season01Path)) {
      console.log('Entries in Season 01:', fs.readdirSync(season01Path))
    }
    expect(fs.existsSync(season01Path)).toBe(true)
    expect(fs.statSync(season01Path).isDirectory()).toBe(true)

    const filesInSeason01 = fs.readdirSync(season01Path)
    const hasE01 = filesInSeason01.some((f) => f.startsWith(PREFIX_E01))
    const hasE02 = filesInSeason01.some((f) => f.startsWith(PREFIX_E02))
    expect(hasE01).toBe(true)
    expect(hasE02).toBe(true)
    const e01Count = filesInSeason01.filter((f) => f.startsWith(PREFIX_E01)).length
    const e02Count = filesInSeason01.filter((f) => f.startsWith(PREFIX_E02)).length
    expect(e01Count).toBe(EXTENSIONS.length)
    expect(e02Count).toBe(EXTENSIONS.length)

    // 5. Assert UI shows new names: expand Season 1 (第 1 季, 12 episodes) and first two episodes, then check displayed paths
    const seasonCards = await $$('div.rounded-lg.border.bg-card.overflow-hidden')
    const seasonCount = await seasonCards.length
    let season1Card = null
    for (let i = 0; i < seasonCount; i++) {
      const card = await seasonCards[i]
      if (card) {
        const text = await card.getText()
        if (text.includes('12 episodes') || text.includes('第 1 季')) {
          season1Card = card
          break
        }
      }
    }
    if (season1Card) {
      await season1Card.click()
      await delay(500)
    }
    const episodeSections = await $$('[data-episode-id]')
    const episodeCount = await episodeSections.length
    for (let i = 0; i < Math.min(2, episodeCount); i++) {
      const el = await episodeSections[i]
      if (el) await el.click()
      await delay(300)
    }
    await delay(500)
    const bodyText = await $('body').getText()
    expect(bodyText).toContain(PREFIX_E01)
    expect(bodyText).toContain(PREFIX_E02)
  })
})
