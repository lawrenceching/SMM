import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests, smm } from './helpers/smm'
import {
  createFolderInTestFolder,
  movieFolder,
  musicFolder,
  tvShowFolder,
  type TestFolder,
} from './helpers/testFolders'

describe('smm CLI e2e', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-e2e-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-e2e-media-'))
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

  it('add --skip-init, list, then rm', async () => {
    const folder = createFolderInTestFolder(mediaDir, tvShowFolder)
    const path = folder.path!

    const added = await smm(['add', path, '--type', folder.type, '--skip-init'])
    expect(added.code).toBe(0)
    expect(added.stdout).toBe(`imported folder ${path}`)
    expect(added.stdout).not.toContain('recognizing')
    expect(added.stdout).not.toContain('succeeded')

    const listed = await smm(['list'])
    expect(listed.code).toBe(0)
    expect(listed.stdout.split('\n').filter(Boolean)).toEqual([path])

    const removed = await smm(['rm', path])
    expect(removed.code).toBe(0)
    expect(removed.stdout).toContain(`Removed ${path}`)

    const listedAfter = await smm(['list'])
    expect(listedAfter.code).toBe(0)
    expect(listedAfter.stdout.trim()).toBe('')
  })

  it(
    'add tvshow, movie, and music folders, then show and metadata',
    { timeout: 10 * 60 * 1000 },
    async () => {
      const tv = createFolderInTestFolder(mediaDir, tvShowFolder)
      const movie = createFolderInTestFolder(mediaDir, movieFolder)
      const music = createFolderInTestFolder(mediaDir, musicFolder)

      await addFolder(tv)
      await addFolder(movie)
      await addFolder(music)

      const listed = await smm(['list'])
      expect(listed.code).toBe(0)
      const listedPaths = listed.stdout.split('\n').filter(Boolean)
      expect(listedPaths).toEqual(expect.arrayContaining([tv.path, movie.path, music.path]))

      const tvShow = await smm(['show', tv.path!])
      expect(tvShow.code).toBe(0)
      expect(tvShow.stdout).toContain('Status:  ok')
      expect(tvShow.stdout).toContain('Type:    tvshow-folder')
      expect(tvShow.stdout).toMatch(/Title:\s+.+/)
      expect(tvShow.stdout).toMatch(/天使降临到我身边|WATATEN|Angel Flew Down/i)

      const tvMeta = await smm(['metadata', tv.path!])
      expect(tvMeta.code).toBe(0)
      expect(tvMeta.stdout).toContain('type: tvshow-folder')
      expect(tvMeta.stdout).toContain('tvShow:')
      expect(tvMeta.stdout).toContain('mediaFiles:')
      expect(tvMeta.stdout).not.toContain('(empty)')
      expect(tvMeta.stdout).toMatch(/seasonNumber:\s*1/)

      const movieShow = await smm(['show', movie.path!])
      expect(movieShow.code).toBe(0)
      expect(movieShow.stdout).toContain('Status:  ok')
      expect(movieShow.stdout).toContain('Type:    movie-folder')
      expect(movieShow.stdout).toMatch(/Title:\s+.+/)
      expect(movieShow.stdout).toMatch(/Dark Knight|黑暗骑士/i)

      const movieMeta = await smm(['metadata', movie.path!])
      expect(movieMeta.code).toBe(0)
      expect(movieMeta.stdout).toContain('type: movie-folder')
      expect(movieMeta.stdout).toContain('movie:')
      expect(movieMeta.stdout).toContain('mediaFiles:')
      expect(movieMeta.stdout).not.toContain('(empty)')

      const musicShow = await smm(['show', music.path!])
      expect(musicShow.code).toBe(0)
      expect(musicShow.stdout).toContain('Status:  ok')
      expect(musicShow.stdout).toContain('Type:    music-folder')
      expect(musicShow.stdout).not.toMatch(/Title:/)

      const musicMeta = await smm(['metadata', music.path!])
      expect(musicMeta.code).toBe(0)
      expect(musicMeta.stdout).toContain('type: music-folder')
      expect(musicMeta.stdout).not.toContain('tvShow:')
      expect(musicMeta.stdout).not.toContain('movie:')
    },
  )
})

async function addFolder(folder: TestFolder): Promise<void> {
  const result = await smm(['add', folder.path!, '--type', folder.type])
  expect(result.code, result.stderr || result.stdout).toBe(0)
  expect(result.stdout).toContain(`imported folder ${folder.path}`)
  expect(result.stdout).toMatch(/succeeded/)
}
