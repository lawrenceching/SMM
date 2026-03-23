import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook, expectMediaMetadataToBe } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { Path } from '@smm/core'
import { hello } from '@smm/test'
import type { RecognizeMediaFilePlan } from '@smm/core/types/RecognizeMediaFilePlan.ts'
import { createAndImportFolder, renameFileInFolder } from 'test/actions/import-folders'
import TVShowPanel from '../componentobjects/TVShowPanel.co'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const FOLDER_NAME = 'PlanRecognizeTest (2021) {tmdbid=67890}'

/** Per-episode: video, poster, subtitle sc/tc, nfo */
const EP_EXTS = ['.mkv', '.jpg', '.sc.ass', '.tc.ass', '.nfo']

const API_BASE = 'http://localhost:30000'

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

async function getPendingPlans(): Promise<{ data: RecognizeMediaFilePlan[] }> {
  const resp = await fetch(API_BASE + '/api/getPendingPlans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const json = await resp.json()
  return json as { data: RecognizeMediaFilePlan[] }
}

describe('TVShow - Recognize By Plan', () => {
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

  it('shows AI recognize prompt, confirms plan, and applies recognition (plan no longer pending)', async function () {
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

    // 2. Create recognize file plan (POSIX paths; files map S01E01.mkv -> (1,1), S01E02.mkv -> (1,2))
    const { userDataDir } = await hello()
    const plansDir = path.join(userDataDir, 'plans')
    fs.mkdirSync(plansDir, { recursive: true })

    const taskId = crypto.randomUUID()
    const planId = crypto.randomUUID()
    const mediaFolderPathPosix = Path.posix(testMediaFolder)

    const plan: RecognizeMediaFilePlan = {
      id: planId,
      task: 'recognize-media-file',
      status: 'pending',
      mediaFolderPath: mediaFolderPathPosix,
      files: [
        { season: 1, episode: 1, path: mediaFolderPathPosix + '/S01E01.mkv' },
        { season: 1, episode: 2, path: mediaFolderPathPosix + '/S01E02.mkv' },
      ],
    }

    planFilePath = path.join(plansDir, taskId + '.plan.json')
    fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2), 'utf-8')
    console.log('Created recognize plan:', planFilePath)

    // 3. Reload page so UI fetches and gets the new plan
    await browser.refresh()
    await delay(2000)

    // 4. Import folder and assert aiBasedRecognizePrompt is visible (Confirm button appears)
    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: testMediaFolder,
      traceId: 'e2eTest:TVShow Recognize By Plan',
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
      { timeout: 20000, interval: 500, timeoutMsg: 'AI recognize prompt (Confirm button) did not appear' }
    )

    // 5. Click Confirm and wait 1s
    await clickFloatingPromptConfirm()
    await delay(1000)

    // 6. Assert plan was applied: plan no longer in pending list (status was set to completed)
    const pending = await getPendingPlans()
    const data = pending.data ?? []
    const stillPending = data.some((p: { id: string }) => p.id === planId)
    expect(stillPending).toBe(false)
  })

  it('shows rule-based recognize prompt, confirms plan', async function () {
    this.timeout(1 * 60 * 1000)

    /**
     * Maximize window to avoid recognize button is folded in "More" menu and not visible
     */
    await browser.maximizeWindow();

    const folderName = '天使降临到我身边！ (2019) {tmdbid=84666}'

    const testFolder = {
      folderName: folderName,
      files: ['S01E01.mp4', 'SecondEpisode.mp4'],
      type: 'tvshow' as const,
    }

    /**
     * 'S01E01.mp4' will be recognized in Media Folder Initialization
     * 'SecondEpisode.mp4' is not able to be recognized because its name doesn't match the build-in recognition rules
     */
    const { path: testMediaFolder } = await createAndImportFolder(testFolder, 'e2eTest:shows rule-based recognize prompt, confirms plan')
    if (!testMediaFolder) {
      throw new Error('testMediaFolder is undefined')
    }
    await TVShowPanel.waitForDisplay()

    /**
     * Rename 'SecondEpisode.mp4' to 'S01E02.mp4' to make it able to be recognized
     */
    await renameFileInFolder(testFolder.folderName, 'SecondEpisode.mp4', 'S01E02.mp4')

    /**
     * Refresh the page so that UI knows the latest file lists
     */
    await browser.refresh()
    await delay(1000)
 
    expect(await TVShowPanel.toString()).toEqual(`特别篇
S00E01 - - - -
第 1 季
S01E01 S01E01.mp4 - - -
S01E02 - - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)

    /**
     * Click the Recognize button and wait for the prompt to appear
     */
    await TVShowPanel.recognizeButton.click()
    await delay(1000)
    // TOOD: TVShowPanel.toString() is not working when TvShowEpisodeTable in review mode
    // expect(await TVShowPanel.toString()).toEqual(`特别篇
    //   S00E01 - - - -
    //   第 1 季
    //   S01E01 S01E01.mp4 - - -
    //   S01E02 S01E02.mp4 - - -
    //   S01E03 - - - -
    //   S01E04 - - - -
    //   S01E05 - - - -
    //   S01E06 - - - -
    //   S01E07 - - - -
    //   S01E08 - - - -
    //   S01E09 - - - -
    //   S01E10 - - - -
    //   S01E11 - - - -
    //   S01E12 - - - -`)

    /**
     * Click the Confirm button and wait for the recognition to complete
     */
    await TVShowPanel.confirmButton.click()
    await delay(1000)
    expect(await TVShowPanel.toString()).toEqual(`特别篇
S00E01 - - - -
第 1 季
S01E01 S01E01.mp4 - - -
S01E02 S01E02.mp4 - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)

    /**
     * Assert the recognition result
     */
    await expectMediaMetadataToBe(testMediaFolder, (metadata) => {
      const mediaFiles: Array<{ absolutePath: string; seasonNumber?: number; episodeNumber?: number }> = metadata.mediaFiles ?? []
      return mediaFiles.some(
        (f) =>
          f.seasonNumber === 1 &&
          f.episodeNumber === 2 &&
          path.basename(f.absolutePath) === 'S01E02.mp4',
      )
    })

  })
})
