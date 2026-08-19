import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MediaMetadata } from '@smm/core'
import { smm } from './helpers/smm'
import { resetCoreForTests } from '../src/core/getCore'
import {
  createAndImportInitializedFolder,
  movieFolder,
  tvShowFolder,
} from './helpers/testFolders'

const SCRAPE_TIMEOUT_MS = 3 * 60 * 1000

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

async function recognizeAndApply(path: string): Promise<void> {
  const recognized = await smm(['try-to-recognize', path])
  expect(recognized.code, recognized.stderr || recognized.stdout).toBe(0)
  const planId = parsePlanId(recognized.stdout)
  const applied = await smm(['apply', planId])
  expect(applied.code, applied.stderr || applied.stdout).toBe(0)
}

function findFileWithPrefix(dir: string, prefix: string): string | undefined {
  return readdirSync(dir).find((name) => name.startsWith(`${prefix}.`))
}

function expectAllTasksCompletedOrSkipped(stdout: string): void {
  for (const task of ['poster', 'fanart', 'thumbnails', 'nfo'] as const) {
    expect(stdout).toMatch(new RegExp(`${task}:\\s+(completed|skipped)`))
  }
}

function removePlaceholderEpisodeThumbnails(path: string): void {
  for (const ep of ['S01E01', 'S01E02', 'S01E03']) {
    const jpg = join(path, `${ep}.jpg`)
    if (existsSync(jpg)) rmSync(jpg)
  }
}

describe('smm scrape CLI e2e', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-scrape-e2e-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-scrape-e2e-media-'))
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

  it(
    'recognize then scrape creates poster, fanart, thumbnails, episode nfos, and tvshow.nfo',
    { timeout: SCRAPE_TIMEOUT_MS },
    async () => {
      const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'Scrape 123123')
      const path = folder.path!

      await recognizeAndApply(path)
      removePlaceholderEpisodeThumbnails(path)

      const scraped = await smm(['scrape', path])
      expect(scraped.code, scraped.stderr || scraped.stdout).toBe(0)
      expectAllTasksCompletedOrSkipped(scraped.stdout)
      expect(scraped.stdout).toMatch(/poster:\s+completed/)
      expect(scraped.stdout).toMatch(/fanart:\s+completed/)
      expect(scraped.stdout).toMatch(/thumbnails:\s+completed/)
      expect(scraped.stdout).toMatch(/nfo:\s+completed/)

      expect(findFileWithPrefix(path, 'poster')).toBeTruthy()
      expect(findFileWithPrefix(path, 'fanart')).toBeTruthy()
      expect(existsSync(join(path, 'tvshow.nfo'))).toBe(true)
      for (const ep of ['S01E01', 'S01E02', 'S01E03']) {
        const jpg = join(path, `${ep}.jpg`)
        expect(existsSync(jpg)).toBe(true)
        expect(statSync(jpg).size).toBeGreaterThan(0)
        expect(existsSync(join(path, `${ep}.nfo`))).toBe(true)
      }
    },
  )

  it(
    'second scrape skips all tasks when artifacts already exist',
    { timeout: SCRAPE_TIMEOUT_MS },
    async () => {
      const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'ScrapeSkipAll 123123')
      const path = folder.path!

      await recognizeAndApply(path)
      removePlaceholderEpisodeThumbnails(path)

      const first = await smm(['scrape', path])
      expect(first.code, first.stderr || first.stdout).toBe(0)

      const second = await smm(['scrape', path])
      expect(second.code, second.stderr || second.stdout).toBe(0)
      expect(second.stdout).toMatch(/poster:\s+skipped/)
      expect(second.stdout).toMatch(/fanart:\s+skipped/)
      expect(second.stdout).toMatch(/thumbnails:\s+skipped/)
      expect(second.stdout).toMatch(/nfo:\s+skipped/)
    },
  )

  it(
    'partial skip: pre-seeded poster.jpg leaves poster skipped and completes other tasks',
    { timeout: SCRAPE_TIMEOUT_MS },
    async () => {
      const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'ScrapePartial 123123')
      const path = folder.path!

      await recognizeAndApply(path)
      removePlaceholderEpisodeThumbnails(path)
      writeFileSync(join(path, 'poster.jpg'), '')

      const scraped = await smm(['scrape', path])
      expect(scraped.code, scraped.stderr || scraped.stdout).toBe(0)
      expect(scraped.stdout).toMatch(/poster:\s+skipped/)
      expect(scraped.stdout).toMatch(/fanart:\s+completed/)
      expect(scraped.stdout).toMatch(/thumbnails:\s+completed/)
      expect(scraped.stdout).toMatch(/nfo:\s+completed/)

      expect(findFileWithPrefix(path, 'fanart')).toBeTruthy()
      expect(existsSync(join(path, 'tvshow.nfo'))).toBe(true)
      expect(existsSync(join(path, 'S01E01.jpg'))).toBe(true)
    },
  )

  it('rejects unmanaged folder', async () => {
    const unmanaged = join(mediaDir, 'not-imported')
    const result = await smm(['scrape', unmanaged])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not managed by SMM/i)
  })

  it('rejects movie folder (not a TV show)', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...movieFolder }, {
      mediaMetadata: {
        type: 'movie-folder',
        mediaFiles: [],
        movie: { database: 'TVDB', id: '116', name: 'The Dark Knight' },
      },
    })
    const result = await smm(['scrape', folder.path!])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not a TV show/i)
  })

  it('rejects TV show with non-TMDB database', async () => {
    const folder = await createAndImportInitializedFolder(
      mediaDir,
      { ...tvShowFolder, folderName: 'TvdbScrape 123123' },
      {
        updateMediaMetadata: (mm) =>
          withWindowsSafeTvShowName({
            ...mm,
            tvShow: mm.tvShow ? { ...mm.tvShow, database: 'TVDB' } : mm.tvShow,
          }),
      },
    )
    const result = await smm(['scrape', folder.path!])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/must use TMDB database/i)
  })
})
