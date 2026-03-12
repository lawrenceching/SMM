import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { randomUUID } from 'node:crypto'
import TVShowPanel from '../componentobjects/TVShowPanel'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { Path } from '@smm/core'
import { hello } from '@smm/test'
import type { RenameFilesPlan, RenameFileEntry } from '@smm/core/types/RenameFilesPlan.ts'
import { folder1, importFolderToApp } from '../actions/import-folders'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = folder1.folderName
const SEASON_01_FOLDER = 'Season 01'
const SHOW_PREFIX = '天使降临到我身边！'
const PREFIX_E01 = SHOW_PREFIX + ' - S01E01 - Episode 1'
const PREFIX_E02 = SHOW_PREFIX + ' - S01E02 - Episode 2'
const PREFIX_E03 = SHOW_PREFIX + ' - S01E03 - Episode 3'
const PREFIX_E01_NEW = '天使降临到我身边！ - S01E01 - Episode 1'
const PREFIX_E02_NEW = '天使降临到我身边！ - S01E02 - Episode 2'
const PREFIX_E03_NEW = '天使降临到我身边！ - S01E03 - Episode 3'

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

    // 1. Create test TV folder and two episodes (video, poster, .sc.ass, .tc.ass, nfo) using folder1
    const testMediaFolder = await importFolderToApp(folder1, 'e2eTest:TVShow Rename By Plan - Import')

    // 2. Wait for initialization
    await TVShowPanel.waitForState(
        (state) => state.title === SHOW_PREFIX && state.table.length > 0
    )

    console.log('Episode table is displayed, folder initialization is complete')

    // 3. Create rename file plan for S01E01 and S01E02 (POSIX paths; preserve .sc.ass / .tc.ass in "to")
    const { userDataDir } = await hello()
    const plansDir = path.join(userDataDir, 'plans')
    fs.mkdirSync(plansDir, { recursive: true })

    const taskId = randomUUID()
    const planId = randomUUID()
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

    // 4. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 5. Click on folder in sidebar to select it (use the display title, not the full folder name)
    const { default: Sidebar } = await import('../componentobjects/Sidebar')
    await Sidebar.clickFolder(SHOW_PREFIX)
    await delay(2000)

    // 6. 此时 rename prompt 应该能正常弹出
    await TVShowPanel.waitForRenamePrompt()

    // 7. Click Confirm and wait 1s
    await TVShowPanel.clickConfirm()
    await delay(1000)

    // 8. Assert UI state after rename
    const uiState = await TVShowPanel.toString()
    console.log('UI state after rename:\n', uiState)
    expect(uiState).toContain('第 1 季')
    expect(uiState).toContain(PREFIX_E01_NEW + '.mkv V V V')
    expect(uiState).toContain(PREFIX_E02_NEW + '.mkv V V V')

    // 9. Assert files renamed correctly (Season 01, video/poster/nfo, and .sc.ass / .tc.ass preserved)
    const season01Path = path.join(testMediaFolder, SEASON_01_FOLDER)
    expect(fs.existsSync(season01Path)).toBe(true)
    expect(fs.statSync(season01Path).isDirectory()).toBe(true)

    const filesInSeason01 = fs.readdirSync(season01Path)
    const hasE01 = filesInSeason01.some((f) => f.startsWith(PREFIX_E01_NEW))
    const hasE02 = filesInSeason01.some((f) => f.startsWith(PREFIX_E02_NEW))
    expect(hasE01).toBe(true)
    expect(hasE02).toBe(true)

    const e01Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E01_NEW))
    const e02Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E02_NEW))
    expect(e01Files.length).toBe(EP_EXTS.length)
    expect(e02Files.length).toBe(EP_EXTS.length)

    expect(e01Files.some((f) => f.endsWith('.sc.ass'))).toBe(true)
    expect(e01Files.some((f) => f.endsWith('.tc.ass'))).toBe(true)
    expect(e02Files.some((f) => f.endsWith('.sc.ass'))).toBe(true)
    expect(e02Files.some((f) => f.endsWith('.tc.ass'))).toBe(true)

    expect(e01Files.some((f) => f === PREFIX_E01_NEW + '.mkv')).toBe(true)
    expect(e01Files.some((f) => f === PREFIX_E01_NEW + '.jpg')).toBe(true)
    expect(e01Files.some((f) => f === PREFIX_E01_NEW + '.nfo')).toBe(true)
    expect(e02Files.some((f) => f === PREFIX_E02_NEW + '.mkv')).toBe(true)
  })

  it('shows AI rename prompt, allows unchecking episodes, and renames only selected episodes', async function () {
    this.timeout(90 * 1000)

    // 1. Create test TV folder with three episodes using folder1
    const testMediaFolder = await importFolderToApp(folder1, 'e2eTest:TVShow Rename By Plan - Selective')

    // 2. Wait for initialization
    await TVShowPanel.waitForState(
        (state) => state.title === SHOW_PREFIX && state.table.length > 0
    )

    console.log('Episode table is displayed, folder initialization is complete')

    // 3. Create rename file plan for all three episodes
    const { userDataDir } = await hello()
    const plansDir = path.join(userDataDir, 'plans')
    fs.mkdirSync(plansDir, { recursive: true })

    const taskId = randomUUID()
    const planId = randomUUID()
    const mediaFolderPathPosix = Path.posix(testMediaFolder)

    const files: RenameFileEntry[] = []
    const episodes = ['S01E01', 'S01E02', 'S01E03']
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

    // 4. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 5. Click on folder in sidebar to select it (use the display title, not the full folder name)
    const { default: Sidebar } = await import('../componentobjects/Sidebar')
    await Sidebar.clickFolder(SHOW_PREFIX)
    await delay(2000)

    // 6. 此时 rename prompt 应该能正常弹出
    await TVShowPanel.waitForRenamePrompt()

    // 7. Uncheck S01E02 episode - this should NOT be renamed
    await TVShowPanel.uncheckEpisode('S01E02')

    // 8. Click Confirm and wait for rename to complete
    await TVShowPanel.clickConfirm()
    await delay(2000)

    // 9. Assert UI state after selective rename
    const uiState = await TVShowPanel.toString()
    console.log('UI state after selective rename:\n', uiState)
    expect(uiState).toContain('第 1 季')
    expect(uiState).toContain(PREFIX_E01 + '.mkv V V V')
    expect(uiState).toContain(PREFIX_E03 + '.mkv V V V')
    expect(uiState).not.toContain(PREFIX_E02 + '.mkv')

    // 10. Assert: Season 01 folder should exist with E01 and E03, but NOT E02
    const season01Path = path.join(testMediaFolder, SEASON_01_FOLDER)
    expect(fs.existsSync(season01Path)).toBe(true)
    expect(fs.statSync(season01Path).isDirectory()).toBe(true)

    const filesInSeason01 = fs.readdirSync(season01Path)

    // E01 and E03 should be renamed (exist in Season 01)
    const hasE01 = filesInSeason01.some((f) => f.startsWith(PREFIX_E01_NEW))
    const hasE03 = filesInSeason01.some((f) => f.startsWith(PREFIX_E03_NEW))
    expect(hasE01).toBe(true)
    expect(hasE03).toBe(true)

    // E02 should NOT be renamed (should NOT exist in Season 01)
    const hasE02 = filesInSeason01.some((f) => f.startsWith(PREFIX_E02_NEW))
    expect(hasE02).toBe(false)

    // E02 original files should still exist in root folder
    for (const ext of EP_EXTS) {
      const originalE02Path = path.join(testMediaFolder, 'S01E02' + ext)
      expect(fs.existsSync(originalE02Path)).toBe(true)
    }

    // Verify E01 and E03 file counts
    const e01Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E01_NEW))
    const e03Files = filesInSeason01.filter((f) => f.startsWith(PREFIX_E03_NEW))
    expect(e01Files.length).toBe(EP_EXTS.length)
    expect(e03Files.length).toBe(EP_EXTS.length)

    console.log('Selective rename test passed: E01 and E03 renamed, E02 unchanged')
  })
})
