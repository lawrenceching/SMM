import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Path } from '@core/path'
import { getCore, resetCoreForTests } from '../src/core/getCore'
import { smm } from './helpers/smm'
import {
  createAndImportInitializedFolder,
  movieFolder,
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

/** Mirrors e2e: import with mediaFiles=[] so rule-based recognize has work to do. */
async function importTvShowWithEmptyMediaFiles(mediaDir: string, folderName?: string) {
  return createAndImportInitializedFolder(
    mediaDir,
    { ...tvShowFolder, ...(folderName ? { folderName } : {}) },
    {
      updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }),
    },
  )
}

describe('smm try-to-recognize / apply CLI e2e', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-recognize-e2e-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-recognize-e2e-media-'))
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

  // Mirrors apps/e2e TVShow-Recognize: import with no mediaFiles → recognize → confirm
  it('rule-based recognize: try-to-recognize then apply maps S01E01..03', async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'UnKnown Folder 123123123123')
    const path = folder.path!

    const tried = await smm(['try-to-recognize', path])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    expect(tried.stdout).toMatch(/task:\s+recognize-media-file/)
    expect(tried.stdout).toMatch(/status:\s+pending/)
    expect(tried.stdout).toContain('S01E01')
    expect(tried.stdout).toContain('S01E02')
    expect(tried.stdout).toContain('S01E03')

    const planId = parsePlanId(tried.stdout)
    expect(existsSync(planPath(userDataDir, planId))).toBe(true)

    const applied = await smm(['apply', planId])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)
    expect(applied.stdout).toMatch(/applied .* \(3 file\(s\)\)/)
    expect(existsSync(planPath(userDataDir, planId))).toBe(false)

    const mm = await getCore().getMediaMetadata(path)
    expect(mm!.mediaFiles).toEqual([
      {
        absolutePath: Path.posix(join(path, 'S01E01.mkv')),
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: Path.posix(join(path, 'S01E02.mkv')),
        seasonNumber: 1,
        episodeNumber: 2,
      },
      {
        absolutePath: Path.posix(join(path, 'S01E03.mkv')),
        seasonNumber: 1,
        episodeNumber: 3,
      },
    ])
  })

  // Mirrors e2e PartialRecognition intent: drop S01E03 naming so only two episodes match.
  // (e2e renames to S01E03-renamed.mkv which still matches pattern1 via includes('S01E03');
  // use a name without that token so CLI partial coverage is real.)
  it('partial coverage: only S01E01..02 match when S01E03 video loses season-episode name', async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'PartialRecognition 123123')
    const path = folder.path!
    renameSync(join(path, 'S01E03.mkv'), join(path, 'extra-video.mkv'))

    const tried = await smm(['try-to-recognize', path])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    const planId = parsePlanId(tried.stdout)
    expect(tried.stdout).toContain('S01E01')
    expect(tried.stdout).toContain('S01E02')
    expect(tried.stdout).not.toMatch(/S01E03\s+/)

    const plan = await getCore().getPlan(planId)
    expect(plan.task).toBe('recognize-media-file')
    if (plan.task === 'recognize-media-file') {
      expect(plan.files).toHaveLength(2)
      expect(plan.files.map((f) => `${f.season}:${f.episode}`)).toEqual(['1:1', '1:2'])
    }

    const applied = await smm(['apply', planId])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)

    const mm = await getCore().getMediaMetadata(path)
    expect(mm!.mediaFiles).toEqual([
      {
        absolutePath: Path.posix(join(path, 'S01E01.mkv')),
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: Path.posix(join(path, 'S01E02.mkv')),
        seasonNumber: 1,
        episodeNumber: 2,
      },
    ])
  })

  // Spec: zero matches → pending plan with files: [] (not an error)
  it('zero matches: pending plan with empty files, apply is no-op on mediaFiles', async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'NoPatternMatch 123123')
    const path = folder.path!
    for (const name of ['S01E01.mkv', 'S01E02.mkv', 'S01E03.mkv']) {
      renameSync(join(path, name), join(path, name.replace('S01E', 'Episode')))
    }

    const tried = await smm(['try-to-recognize', path])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    expect(tried.stdout).toMatch(/status:\s+pending/)
    expect(tried.stdout).toContain('(none)')
    const planId = parsePlanId(tried.stdout)

    const plan = await getCore().getPlan(planId)
    expect(plan.task).toBe('recognize-media-file')
    if (plan.task === 'recognize-media-file') {
      expect(plan.files).toEqual([])
    }

    const before = await getCore().getMediaMetadata(path)
    const applied = await smm(['apply', planId])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)
    expect(applied.stdout).toMatch(/\(0 file\(s\)\)/)
    expect(existsSync(planPath(userDataDir, planId))).toBe(false)

    const after = await getCore().getMediaMetadata(path)
    expect(after?.mediaFiles ?? []).toEqual(before?.mediaFiles ?? [])
  })

  // Mirrors e2e AlreadyRecognized: folder already has mediaFiles mappings
  it('already recognized: try-to-recognize still builds a plan that can be applied', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, {
      ...tvShowFolder,
      folderName: 'AlreadyRecognized 123123',
    })
    const path = folder.path!

    const seeded = await getCore().getMediaMetadata(path)
    expect(seeded?.mediaFiles?.length).toBeGreaterThan(0)

    const tried = await smm(['try-to-recognize', path])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    const planId = parsePlanId(tried.stdout)
    expect(tried.stdout).toContain('S01E01')

    const applied = await smm(['apply', planId])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)

    const mm = await getCore().getMediaMetadata(path)
    expect(mm!.mediaFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          absolutePath: Path.posix(join(path, 'S01E01.mkv')),
          seasonNumber: 1,
          episodeNumber: 1,
        }),
      ]),
    )
  })

  it('rejects unmanaged folder', async () => {
    const unmanaged = join(mediaDir, 'not-imported')
    const result = await smm(['try-to-recognize', unmanaged])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not managed by SMM/i)
  })

  it('rejects movie folder (not a TV show with episodes)', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...movieFolder }, {
      mediaMetadata: {
        type: 'movie-folder',
        mediaFiles: [],
        movie: { database: 'TVDB', id: '116', name: 'The Dark Knight' },
      },
    })
    const result = await smm(['try-to-recognize', folder.path!])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not a TV show with episodes/i)
  })

  it('apply rejects missing plan id', async () => {
    const result = await smm(['apply', '00000000-0000-0000-0000-000000000000'])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Plan not found/i)
  })
})
