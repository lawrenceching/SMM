import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { Path } from '@smm/core'
import { hello } from '@smm/test'
import type { RenameFilesPlan, RenameFileEntry } from '@smm/core/types/RenameFilesPlan.ts'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = 'PlanRenameTest (2020) {tmdbid=12345}'
const SEASON_01_FOLDER = 'Season 01'
const SHOW_PREFIX = 'PlanRenameTest'
const PREFIX_E01 = SHOW_PREFIX + ' - S01E01 - Episode 1'
const PREFIX_E02 = SHOW_PREFIX + ' - S01E02 - Episode 2'

/** Per-episode: video, poster, subtitle sc/tc, nfo */
const EP_EXTS = ['.mkv', '.jpg', '.sc.ass', '.tc.ass', '.nfo']

/** Confirm button labels (en and zh-CN). */
const CONFIRM_LABELS = ['Confirm', '确认']

/**
 * Click the Confirm button in the visible floating prompt.
 */
async function clickFloatingPromptConfirm() {
  await browser.waitUntil(
    async () => {
      for (const label of CONFIRM_LABELS) {
        const selector = 'button=' + label
        const btn = await $(selector)
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

describe('TVShow - Rename By Plan', () => {
  let planFilePath: string | null = null

  before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

  afterEach(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
    if (planFilePath && fs.existsSync(planFilePath)) {
      fs.unlinkSync(planFilePath)
      console.log('Removed plan file:', planFilePath)
      planFilePath = null
    }
  })

  it('shows AI rename prompt, confirms plan, and renames files preserving subtitle language suffixes (.sc.ass, .tc.ass)', async function () {
    this.timeout(90 * 1000)

    // 1. Create test TV folder and two episodes (video, poster, .sc.ass, .tc.ass, nfo)
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    for (const ep of ['S01E01', 'S01E02']) {
      for (const ext of EP_EXTS) {
        const filePath = path.join(testMediaFolder, ep + ext)
        fs.writeFileSync(filePath, '')
      }
    }
    console.log('Created media folder with episode files:', testMediaFolder)

    // 2. Create rename file plan (POSIX paths; preserve .sc.ass / .tc.ass in "to")
    const { userDataDir } = await hello()
    const plansDir = path.join(userDataDir, 'plans')
    fs.mkdirSync(plansDir, { recursive: true })

    const taskId = crypto.randomUUID()
    const planId = crypto.randomUUID()
    const mediaFolderPathPosix = Path.posix(testMediaFolder)

    const files: RenameFileEntry[] = []
    for (const ep of ['S01E01', 'S01E02']) {
      const episodeTitle = ep === 'S01E01' ? 'Episode 1' : 'Episode 2'
      const newBase = SHOW_PREFIX + ' - ' + ep + ' - ' + episodeTitle
      for (const ext of EP_EXTS) {
        const from = mediaFolderPathPosix + '/' + ep + ext
        const to = mediaFolderPathPosix + '/' + SEASON_01_FOLDER + '/' + newBase + ext
        files.push({ from, to })
      }
    }

    const plan: RenameFilesPlan = {
      id: planId,
      task: 'rename-files',
      status: 'pending',
      mediaFolderPath: mediaFolderPathPosix,
      files,
    }

    planFilePath = path.join(plansDir, taskId + '.plan.json')
    fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8')
    console.log('Created rename plan:', planFilePath)

    // 3. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 4. Import folder and assert aiBasedRenameFilePrompt is visible (Confirm button appears)
    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Rename By Plan',
    })
    await delay(3000)

    await browser.waitUntil(
      async () => {
        for (const label of CONFIRM_LABELS) {
          const selector = 'button=' + label
          const btn = await $(selector)
          if (await btn.isDisplayed().catch(() => false)) return true
        }
        return false
      },
      { timeout: 20000, interval: 500, timeoutMsg: 'AI rename prompt (Confirm button) did not appear' }
    )

    // 5. Click Confirm and wait 1s
    await clickFloatingPromptConfirm()
    await delay(1000)

    // 6. Assert files renamed correctly (Season 01, video/poster/nfo, and .sc.ass / .tc.ass preserved)
    const season01Path = path.join(testMediaFolder, SEASON_01_FOLDER)
    expect(fs.existsSync(season01Path)).toBe(true)
    expect(fs.statSync(season01Path).isDirectory()).toBe(true)

    const filesInSeason01 = fs.readdirSync(season01Path)
    const hasE01 = filesInSeason01.some((f) => f.startsWith(PREFIX_E01))
    const hasE02 = filesInSeason01.some((f) => f.startsWith(PREFIX_E02))
    expect(hasE01).toBe(true)
    expect(hasE02).toBe(true)

    const e01Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E01))
    const e02Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E02))
    expect(e01Files.length).toBe(EP_EXTS.length)
    expect(e02Files.length).toBe(EP_EXTS.length)

    expect(e01Files.some((f) => f.endsWith('.sc.ass'))).toBe(true)
    expect(e01Files.some((f) => f.endsWith('.tc.ass'))).toBe(true)
    expect(e02Files.some((f) => f.endsWith('.sc.ass'))).toBe(true)
    expect(e02Files.some((f) => f.endsWith('.tc.ass'))).toBe(true)

    expect(e01Files.some((f) => f === PREFIX_E01 + '.mkv')).toBe(true)
    expect(e01Files.some((f) => f === PREFIX_E01 + '.jpg')).toBe(true)
    expect(e01Files.some((f) => f === PREFIX_E01 + '.nfo')).toBe(true)
    expect(e02Files.some((f) => f === PREFIX_E02 + '.mkv')).toBe(true)
  })
})
