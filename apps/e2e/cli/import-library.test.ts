import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFolderInTestFolder, folder1, folder2, musicFolder } from '@smm/test'
import { setup, cleanup, bin } from './base'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000

describe('import library', () => {
  let libraryPath: string

  beforeEach(async () => {
    libraryPath = mkdtempSync(join(tmpdir(), 'smm-cli-library-'))
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
    })
  })

  afterEach(async () => {
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
    })
    rmSync(libraryPath, { recursive: true, force: true })
  })

  it('import TV show library', async () => {
    const show1 = createFolderInTestFolder(libraryPath, folder1)
    const show2 = createFolderInTestFolder(libraryPath, {
      ...folder1,
      folderName: 'UnknownFolder',
      files: ['S01E01.mkv'],
    })

    const ret = await $`${bin} addlib ${libraryPath} --type tvshow --verbose
${bin} list
    `.nothrow()

    expect(ret.exitCode).toBe(0)
    expect(ret.text()).toContain(show1.path!)
    expect(ret.text()).toContain(show2.path!)
  }, FIVE_MINUTES_MS)

  it('import movie library', async () => {
    createFolderInTestFolder(libraryPath, folder2)

    const ret = await $`${bin} addlib ${libraryPath} --type movie --verbose`.nothrow()

    expect(ret.exitCode).toBe(0)
    expect(ret.text()).toContain('importing library')
    expect(ret.text()).toContain('succeeded')
  }, FIVE_MINUTES_MS)

  it('import music library with --skip-init', async () => {
    const music = createFolderInTestFolder(libraryPath, musicFolder)

    const ret = await $`${bin} addlib ${libraryPath} --type music --skip-init
${bin} list
    `.nothrow()

    expect(ret.exitCode).toBe(0)
    expect(ret.text()).toContain(music.path!)
    expect(ret.text()).toContain(`imported folder ${music.path}`)
  }, FIVE_MINUTES_MS)
})
