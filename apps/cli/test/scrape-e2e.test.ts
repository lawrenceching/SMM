import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MediaMetadata } from '@smm/core'
import { smm } from './helpers/smm'
import { resetCoreForTests } from '../src/core/getCore'
import {
  createAndImportInitializedFolder,
  tvShowFolder,
} from './helpers/testFolders'

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
    'recognize then scrape creates poster, fanart, thumbnail, and nfo on disk',
    { timeout: 3 * 60 * 1000 },
    async () => {
    const folder = await importTvShowWithEmptyMediaFiles(mediaDir, 'Scrape 123123')
    const path = folder.path!

    await recognizeAndApply(path)

    const scraped = await smm(['scrape', path])
    expect(scraped.code, scraped.stderr || scraped.stdout).toBe(0)
    expect(scraped.stdout).toMatch(/poster:\s+(completed|skipped)/)
    expect(scraped.stdout).toMatch(/fanart:\s+(completed|skipped)/)
    expect(scraped.stdout).toMatch(/thumbnails:\s+(completed|skipped)/)
    expect(scraped.stdout).toMatch(/nfo:\s+(completed|skipped)/)

    expect(findFileWithPrefix(path, 'poster')).toBeTruthy()
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
})
