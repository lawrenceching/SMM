import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MediaMetadata } from '@smm/types'
import { getCore, resetCoreForTests } from '../src/core/getCore'
import { smm } from './helpers/smm'
import { createFolderInTestFolder, type TestFolder } from './helpers/testFolders'

/**
 * Covers InitializeTvShowByTvdb NFO case: preferMediaLanguage zh-CN must localize
 * episode titles from TVDB (not leave season-extended default Japanese names).
 */
describe('smm import TVDB NFO language', () => {
  let userDataDir: string
  let appDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-tvdb-nfo-ud-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-tvdb-nfo-app-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-tvdb-nfo-media-'))
    process.env.USER_DATA_DIR = userDataDir
    process.env.APP_DATA_DIR = appDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    if (prevAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = prevAppDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(appDataDir, { recursive: true, force: true })
    rmSync(mediaDir, { recursive: true, force: true })
  })

  it(
    'import via tvshow.nfo tvdbid uses preferMediaLanguage for episode names',
    { timeout: 10 * 60 * 1000 },
    async () => {
      const setDb = await smm(['config', 'set', 'primaryDatabase', '"TVDB"'])
      expect(setDb.code, setDb.stderr || setDb.stdout).toBe(0)
      const setLang = await smm(['config', 'set', 'preferMediaLanguage', '"zh-CN"'])
      expect(setLang.code, setLang.stderr || setLang.stdout).toBe(0)

      const fixture: TestFolder = {
        folderName: 'WhateverItIsToEnsureCannotRecognizeByFolderName',
        files: ['S01E01.mkv', 'S01E02.mkv', 'S01E03.mkv'],
        type: 'tvshow',
      }
      const folder = createFolderInTestFolder(mediaDir, fixture)
      const path = folder.path!
      writeFileSync(
        join(path, 'tvshow.nfo'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>355969</id>
  <tvdbid>355969</tvdbid>
</tvshow>`,
        'utf-8',
      )

      const added = await smm(['add', path, '--type', 'tvshow'])
      expect(added.code, added.stderr || added.stdout).toBe(0)
      expect(added.stdout).toMatch(/succeeded/)

      const mm = (await getCore().getMetadata(path)) as MediaMetadata
      expect(mm.tvShow?.database).toBe('TVDB')
      expect(mm.tvShow?.id).toBe('355969')
      expect(mm.tvShow?.name).toMatch(/天使/)

      const season1 = mm.tvShow?.seasons?.find((s) => s.season === 1)
      expect(season1?.episodes?.[0]?.name).toBe('心裏癢癢的感覺')
      expect(season1?.episodes?.[0]?.name).not.toBe('もにょっとした気持ち')
    },
  )
})
