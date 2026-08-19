import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Path } from '@core/path'
import type { MediaMetadata } from '@smm/core'
import { getCore, resetCoreForTests } from '../src/core/getCore'
import { smm } from './helpers/smm'
import {
  createAndImportInitializedFolder,
  tvShowFolder,
} from './helpers/testFolders'

function planPath(userDataDir: string, planId: string): string {
  return join(userDataDir, 'plans', `${planId}.plan.json`)
}

function parsePlanId(stdout: string): string {
  const planId = stdout.match(/plan:\s+([0-9a-f-]{36})/i)?.[1]
  expect(planId, stdout).toBeTruthy()
  return planId!
}

/** TMDB template name contains ":" which is invalid on Windows paths. */
function withWindowsSafeTvShowName(mm: MediaMetadata): MediaMetadata {
  return {
    ...mm,
    tvShow: mm.tvShow
      ? { ...mm.tvShow, name: 'WATATEN an Angel Flew Down to Me' }
      : mm.tvShow,
  }
}

async function importTvShowWithEmptyMediaFiles(mediaDir: string, folderName?: string) {
  return createAndImportInitializedFolder(
    mediaDir,
    { ...tvShowFolder, ...(folderName ? { folderName } : {}) },
    {
      updateMediaMetadata: (mm) =>
        withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
    },
  )
}

const PLEX_S01E01_BASENAME =
  'WATATEN an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv'

describe('smm try-to-rename / apply CLI e2e', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-rename-files-e2e-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-rename-files-e2e-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaDir, { recursive: true, force: true })
  })

  it('plex rename: recognize then try-to-rename then apply moves S01E01 into Season 01', async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'RenameFiles 123123')
    const path = folder.path!

    const recognized = await smm(['try-to-recognize', path])
    expect(recognized.code, recognized.stderr || recognized.stdout).toBe(0)
    const recognizePlanId = parsePlanId(recognized.stdout)
    const appliedRecognize = await smm(['apply', recognizePlanId])
    expect(appliedRecognize.code, appliedRecognize.stderr || appliedRecognize.stdout).toBe(0)

    const tried = await smm(['try-to-rename', path, '--rule', 'plex'])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    expect(tried.stdout).toMatch(/task:\s+rename-files/)
    expect(tried.stdout).toMatch(/status:\s+pending/)
    expect(tried.stdout).toContain('Season 01')
    expect(tried.stdout).toContain('S01E01.mkv')
    expect(tried.stdout).toContain(PLEX_S01E01_BASENAME)

    const planId = parsePlanId(tried.stdout)
    expect(existsSync(planPath(userDataDir, planId))).toBe(true)

    const applied = await smm(['apply', planId])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)
    expect(applied.stdout).toMatch(/applied .* \(3 file\(s\)\)/)
    expect(existsSync(planPath(userDataDir, planId))).toBe(false)

    const renamedVideo = join(path, 'Season 01', PLEX_S01E01_BASENAME)
    expect(existsSync(renamedVideo)).toBe(true)
    expect(existsSync(join(path, 'S01E01.mkv'))).toBe(false)

    const mm = await getCore().getMediaMetadata(path)
    expect(mm!.mediaFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          absolutePath: Path.posix(join(path, 'Season 01', PLEX_S01E01_BASENAME)),
          seasonNumber: 1,
          episodeNumber: 1,
        }),
      ]),
    )
  })

  it('rejects unmanaged folder', async () => {
    const unmanaged = join(mediaDir, 'not-imported')
    const result = await smm(['try-to-rename', unmanaged])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not managed by SMM/i)
  })

  it('rejects unsupported rename rule', async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'BadRule 123123')
    const result = await smm(['try-to-rename', folder.path!, '--rule', 'jellyfin'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Unsupported rename rule/i)
  })
})
