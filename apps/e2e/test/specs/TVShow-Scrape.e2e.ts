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

/** Scrape button in TvShowHeader (en and zh-CN). */
const SCRAPE_BUTTON_LABELS = ['Scrape', '刮削']

/** ScrapeDialog Start button (en and zh-CN). */
const SCRAPE_START_LABELS = ['Start', '开始']

/** ScrapeDialog Done button (en and zh-CN). */
const SCRAPE_DONE_LABELS = ['Done', '完成']

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function waitForScrapeButtonDisplayed() {
  await browser.waitUntil(
    async () => {
      for (const label of SCRAPE_BUTTON_LABELS) {
        const btn = await $(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) return true
      }
      return false
    },
    { timeout: 20000, interval: 500, timeoutMsg: 'Scrape button did not appear in TV show header' }
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
  throw new Error('Scrape button did not appear in TV show header')
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

describe('TVShow - Scrape', () => {
  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('opens ScrapeDialog, runs scrape tasks, and stores poster, fanart, nfo in media folder', async function () {
    this.timeout(150 * 1000)

    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    for (const ep of ['S01E01', 'S01E02']) {
      const filePath = path.join(testMediaFolder, `${ep}.mp4`)
      fs.writeFileSync(filePath, '')
    }
    console.log('Created media folder with episode video files:', testMediaFolder)

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Scrape',
    })
    await delay(3 * 1000)

    await waitForScrapeButtonDisplayed()
    await clickScrapeButton()
    await delay(1000)

    await clickScrapeDialogStart()
    await waitForScrapeDialogDone()
    await delay(2000)

    const filesInMediaFolder = fs.readdirSync(testMediaFolder)

    expect(fs.existsSync(path.join(testMediaFolder, 'tvshow.nfo'))).toBe(true)

    // Episode NFOs: one per video, same basename + .nfo
    expect(fs.existsSync(path.join(testMediaFolder, 'S01E01.nfo'))).toBe(true)
    expect(fs.existsSync(path.join(testMediaFolder, 'S01E02.nfo'))).toBe(true)
    const s01e01Nfo = fs.readFileSync(path.join(testMediaFolder, 'S01E01.nfo'), 'utf-8')
    expect(s01e01Nfo).toContain('<episodedetails>')
    expect(s01e01Nfo).toContain('<title>')
    expect(s01e01Nfo).toContain('<season>1</season>')
    expect(s01e01Nfo).toContain('<episode>1</episode>')
    expect(s01e01Nfo).toContain('<original_filename>S01E01.mp4</original_filename>')

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
