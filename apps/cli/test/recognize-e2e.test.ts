import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Path } from '@core/path'
import { getCore, resetCoreForTests } from '../src/core/getCore'
import { smm } from './helpers/smm'
import { createAndImportInitializedFolder, tvShowFolder } from './helpers/testFolders'

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

  it('try-to-recognize then apply updates mediaFiles', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...tvShowFolder }, {
      updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }),
    })
    const path = folder.path!

    const tried = await smm(['try-to-recognize', path])
    expect(tried.code, tried.stderr || tried.stdout).toBe(0)
    expect(tried.stdout).toMatch(/plan:\s+[0-9a-f-]{36}/i)
    const planId = tried.stdout.match(/plan:\s+([0-9a-f-]{36})/i)?.[1]
    expect(planId).toBeTruthy()

    const applied = await smm(['apply', planId!])
    expect(applied.code, applied.stderr || applied.stdout).toBe(0)

    const mm = await getCore().getMediaMetadata(path)
    expect(mm?.mediaFiles?.length).toBeGreaterThan(0)
    expect(mm?.mediaFiles?.[0]?.seasonNumber).toBe(1)
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
})
