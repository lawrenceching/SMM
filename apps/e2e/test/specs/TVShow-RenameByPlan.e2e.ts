import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import TVShowPanel from '../componentobjects/TVShowPanel'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { Path } from '@smm/core'
import { hello } from '@smm/test'
import type { RenameFilesPlan, RenameFileEntry } from '@smm/core/types/RenameFilesPlan.ts'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const SEASON_01_FOLDER = 'Season 01'
const SHOW_PREFIX = '天使降临到我身边！'
const PREFIX_E01 = SHOW_PREFIX + ' - S01E01 - Episode 1'
const PREFIX_E02 = SHOW_PREFIX + ' - S01E02 - Episode 2'
const PREFIX_E03 = SHOW_PREFIX + ' - S01E03 - Episode 3'

/** Per-episode: video, poster, subtitle sc/tc, nfo */
const EP_EXTS = ['.mkv', '.jpg', '.sc.ass', '.tc.ass', '.nfo']

describe('TVShow - Rename By Plan', () => {
  let planFilePath: string | null = null

  beforeEach(async () => {
    await createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false })()
  })

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

    // 2. Import folder and wait for initialization
    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Rename By Plan - Import',
    })
    await delay(5000)

    // 3. Wait for episode table to be displayed (indicates initialization is complete)
    await TVShowPanel.waitForTable()

    console.log('Episode table is displayed, folder initialization is complete')

    // 4. Create rename file plan (POSIX paths; preserve .sc.ass / .tc.ass in "to")
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

    // 5. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 6. Click on folder in sidebar to select it (use the display title, not the full folder name)
    const { default: Sidebar } = await import('../componentobjects/Sidebar')
    await Sidebar.clickFolder(SHOW_PREFIX)
    await delay(2000)

    // 7. 此时 rename prompt 应该能正常弹出
    await TVShowPanel.waitForRenamePrompt()

    // 8. Click Confirm and wait 1s
    await TVShowPanel.clickConfirm()
    await delay(1000)

    // 9. Assert files renamed correctly (Season 01, video/poster/nfo, and .sc.ass / .tc.ass preserved)
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

  it('shows AI rename prompt, allows unchecking episodes, and renames only selected episodes', async function () {
    this.timeout(90 * 1000)

    // 1. Create test TV folder with three episodes
    const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    const episodes = ['S01E01', 'S01E02', 'S01E03']
    for (const ep of episodes) {
      for (const ext of EP_EXTS) {
        const filePath = path.join(testMediaFolder, ep + ext)
        fs.writeFileSync(filePath, '')
      }
    }
    console.log('Created media folder with episode files:', testMediaFolder)

    // 2. Import folder and wait for initialization
    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Rename By Plan - Selective',
    })
    await delay(5000)

    // 3. Wait for episode table to be displayed (indicates initialization is complete)
    await TVShowPanel.waitForTable()

    console.log('Episode table is displayed, folder initialization is complete')

    // 4. Create rename file plan for all three episodes
    const { userDataDir } = await hello()
    const plansDir = path.join(userDataDir, 'plans')
    fs.mkdirSync(plansDir, { recursive: true })

    const taskId = crypto.randomUUID()
    const planId = crypto.randomUUID()
    const mediaFolderPathPosix = Path.posix(testMediaFolder)

    const files: RenameFileEntry[] = []
    for (const ep of episodes) {
      const episodeNum = ep.slice(-2)
      const episodeTitle = 'Episode ' + parseInt(episodeNum, 10)
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

    // 5. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 6. Click on folder in sidebar to select it (use the display title, not the full folder name)
    const { default: Sidebar } = await import('../componentobjects/Sidebar')
    await Sidebar.clickFolder(SHOW_PREFIX)
    await delay(2000)

    // 7. 此时 rename prompt 应该能正常弹出
    await TVShowPanel.waitForRenamePrompt()

    // 8. Uncheck S01E02 episode - this should NOT be renamed
    await TVShowPanel.uncheckEpisode('S01E02')

    // 9. Click Confirm and wait for rename to complete
    await TVShowPanel.clickConfirm()
    await delay(2000)

    // 10. Assert: Season 01 folder should exist with E01 and E03, but NOT E02
    const season01Path = path.join(testMediaFolder, SEASON_01_FOLDER)
    expect(fs.existsSync(season01Path)).toBe(true)
    expect(fs.statSync(season01Path).isDirectory()).toBe(true)

    const filesInSeason01 = fs.readdirSync(season01Path)

    // E01 and E03 should be renamed (exist in Season 01)
    const hasE01 = filesInSeason01.some((f) => f.startsWith(PREFIX_E01))
    const hasE03 = filesInSeason01.some((f) => f.startsWith(PREFIX_E03))
    expect(hasE01).toBe(true)
    expect(hasE03).toBe(true)

    // E02 should NOT be renamed (should NOT exist in Season 01)
    const hasE02 = filesInSeason01.some((f) => f.startsWith(PREFIX_E02))
    expect(hasE02).toBe(false)

    // E02 original files should still exist in root folder
    for (const ext of EP_EXTS) {
      const originalE02Path = path.join(testMediaFolder, 'S01E02' + ext)
      expect(fs.existsSync(originalE02Path)).toBe(true)
    }

    // Verify E01 and E03 file counts
    const e01Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E01))
    const e03Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E03))
    expect(e01Files.length).toBe(EP_EXTS.length)
    expect(e03Files.length).toBe(EP_EXTS.length)

    console.log('Selective rename test passed: E01 and E03 renamed, E02 unchanged')
  })
})
