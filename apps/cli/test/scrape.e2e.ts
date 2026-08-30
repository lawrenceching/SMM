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
import { smm } from './helpers/smm'
import { resetCoreForTests } from '../src/core/getCore'
import {
  createAndImportInitializedFolder,
  folder1,
  movieFolder,
  tvShowFolder,
  type TestFolder,
} from './helpers/testFolders'

const SCRAPE_TIMEOUT_MS = 3 * 60 * 1000

function parsePlanId(stdout: string): string {
  const planId = stdout.match(/plan:\s+([0-9a-f-]{36})/i)?.[1]
  expect(planId, stdout).toBeTruthy()
  return planId!
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
  for (const task of ['poster', 'fanart', 'thumbnail', 'nfo'] as const) {
    expect(stdout).toMatch(new RegExp(`${task} [✓–]`))
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
      const testFolder: TestFolder = {
        ...folder1,
        folderName: 'Scrape 123123',
        files: [],
      }
      const folder = await createAndImportInitializedFolder(mediaDir, testFolder)
      const path = folder.path!

      await recognizeAndApply(path)

      const scraped = await smm(['scrape', path, '--wait'])
      expect(scraped.code, scraped.stderr || scraped.stdout).toBe(0)
      expectAllTasksCompletedOrSkipped(scraped.stdout)
      expect(scraped.stdout).toMatch(/poster ✓/)
      expect(scraped.stdout).toMatch(/fanart ✓/)
      expect(scraped.stdout).toMatch(/thumbnail ✓/)
      expect(scraped.stdout).toMatch(/nfo ✓/)

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
      const testFolder: TestFolder = {
        ...folder1,
        folderName: 'ScrapeSkipAll 123123',
        files: [],
      }
      const folder = await createAndImportInitializedFolder(mediaDir, testFolder)
      const path = folder.path!

      await recognizeAndApply(path)

      const first = await smm(['scrape', path, '--wait'])
      expect(first.code, first.stderr || first.stdout).toBe(0)

      const second = await smm(['scrape', path, '--wait'])
      expect(second.code, second.stderr || second.stdout).toBe(0)
      expect(second.stdout).toMatch(/poster –/)
      expect(second.stdout).toMatch(/fanart –/)
      expect(second.stdout).toMatch(/thumbnail –/)
      expect(second.stdout).toMatch(/nfo –/)
    },
  )

  it(
    'partial skip: pre-seeded poster.jpg leaves poster skipped and completes other tasks',
    { timeout: SCRAPE_TIMEOUT_MS },
    async () => {
      const testFolder: TestFolder = {
        ...folder1,
        folderName: 'ScrapePartial 123123',
        files: [],
      }
      const folder = await createAndImportInitializedFolder(mediaDir, testFolder)
      const path = folder.path!

      await recognizeAndApply(path)
      writeFileSync(join(path, 'poster.jpg'), '')

      const scraped = await smm(['scrape', path, '--wait'])
      expect(scraped.code, scraped.stderr || scraped.stdout).toBe(0)
      expect(scraped.stdout).toMatch(/poster –/)
      expect(scraped.stdout).toMatch(/fanart ✓/)
      expect(scraped.stdout).toMatch(/thumbnail ✓/)
      expect(scraped.stdout).toMatch(/nfo ✓/)

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

  it('starts scrape job for movie folder (Core accepts movie × TMDB)', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...movieFolder }, {
      mediaMetadata: {
        type: 'movie-folder',
        mediaFiles: [],
        movie: { database: 'TMDB', id: '116', name: 'The Dark Knight' },
      },
    })
    const result = await smm(['scrape', folder.path!])
    expect(result.code, result.stderr || result.stdout).toBe(0)
    expect(result.stdout.trim()).toMatch(/^[0-9a-z]+-[0-9a-z]+$/i)
  })

  it('starts scrape job for TV show with TVDB database', async () => {
    const folder = await createAndImportInitializedFolder(
      mediaDir,
      { ...tvShowFolder, folderName: 'TvdbScrape 123123' },
      { templateFileName: '我推的孩子.metadata.json' },
    )
    const result = await smm(['scrape', folder.path!])
    expect(result.code, result.stderr || result.stdout).toBe(0)
    expect(result.stdout.trim()).toMatch(/^[0-9a-z]+-[0-9a-z]+$/i)
  })
})
