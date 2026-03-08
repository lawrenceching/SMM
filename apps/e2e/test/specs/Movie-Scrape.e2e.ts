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

/** Movie folder with TMDB ID so the app loads TMDB data and enables the Scrape button. */
const FOLDER_NAME = '哪吒之魔童降世 (2019) {tmdbid=552524}'

/** Scrape button in movie overview (en and zh-CN). */
const SCRAPE_BUTTON_LABELS = ['Scrape', '刮削']

/** ScrapeDialog Start button (en and zh-CN). */
const SCRAPE_START_LABELS = ['Start', '开始']

/** ScrapeDialog Done button (en and zh-CN). */
const SCRAPE_DONE_LABELS = ['Done', '完成']

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

/** Sidebar displays folder basename for movie (AppV2 mediaName fallback). */
const SIDEBAR_FOLDER_DISPLAY_NAME = FOLDER_NAME

async function waitForScrapeButtonDisplayed() {
  await browser.waitUntil(
    async () => {
      for (const label of SCRAPE_BUTTON_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 20000, interval: 500, timeoutMsg: 'Scrape button did not appear in movie overview' }
  )
}

async function clickScrapeButton() {
  for (const label of SCRAPE_BUTTON_LABELS) {
    const b = await $(`button=${label}`)
    if (await b.isDisplayed().catch(() => false)) {
      await b.waitForClickable({ timeout: 5000 })
      await b.click()
      return
    }
  }
  throw new Error('Scrape button did not appear in movie overview')
}

/** Wait for ScrapeDialog Start button and click it. */
async function clickScrapeDialogStart() {
  await browser.waitUntil(
    async () => {
      for (const label of SCRAPE_START_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 10000, interval: 500, timeoutMsg: 'ScrapeDialog Start button did not appear' }
  )
  for (const label of SCRAPE_START_LABELS) {
    const b = await $(`button=${label}`)
    if (await b.isDisplayed().catch(() => false)) {
      await b.waitForClickable({ timeout: 5000 })
      await b.click()
      return
    }
  }
  throw new Error('ScrapeDialog Start button did not appear')
}

/** Wait until ScrapeDialog shows Done (all tasks completed). */
async function waitForScrapeDialogDone() {
  await browser.waitUntil(
    async () => {
      for (const label of SCRAPE_DONE_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 120000, interval: 2000, timeoutMsg: 'ScrapeDialog did not show Done button (tasks may still be running)' }
  )
}

describe('Movie - Scrape', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('opens ScrapeDialog, runs scrape tasks, and stores poster, fanart in media folder', async function () {
    this.timeout(150 * 1000)

    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })
    fs.writeFileSync(path.join(testMediaFolder, 'movie.mp4'), '')
    console.log('Created movie folder with video file:', testMediaFolder)

    await Menu.importMediaFolder({
      type: 'movie',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:Movie Scrape',
    })
    await delay(3 * 1000)

    await Sidebar.waitForFolder(SIDEBAR_FOLDER_DISPLAY_NAME, 30000)
    await Sidebar.clickFolder(SIDEBAR_FOLDER_DISPLAY_NAME)
    await delay(1000)

    await waitForScrapeButtonDisplayed()
    await clickScrapeButton()
    await delay(1000)

    await clickScrapeDialogStart()
    await waitForScrapeDialogDone()
    await delay(2000)

    const filesInMediaFolder = fs.readdirSync(testMediaFolder)

    const hasPoster = filesInMediaFolder.some(
      (f) => f.startsWith('poster.') && IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))
    )
    expect(hasPoster).toBe(true)

    const hasFanart = filesInMediaFolder.some(
      (f) => f.startsWith('fanart.') && IMAGE_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))
    )
    expect(hasFanart).toBe(true)
  })
})
