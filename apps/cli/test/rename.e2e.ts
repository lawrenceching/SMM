import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Path } from '@core/path'
import { getCore, resetCoreForTests } from '../src/core/getCore'
import { smm } from './helpers/smm'
import {
  createAndImportInitializedFolder,
  metadataCachePath,
  movieFolder,
  renamedFolderPath,
  tvShowFolder,
} from './helpers/testFolders'

describe('smm rename CLI e2e (pre-initialized import)', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-rename-e2e-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-cli-rename-e2e-media-'))
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

  it('renames a pre-initialized tvshow folder via smm rename', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...tvShowFolder })
    const from = folder.path!
    const to = renamedFolderPath(from, folder.folderName)

    const renamed = await smm(['rename', from, to])
    expect(renamed.code, renamed.stderr || renamed.stdout).toBe(0)
    expect(renamed.stdout).toContain(`${Path.posix(from)} → ${Path.posix(to)}`)

    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
    expect(existsSync(join(to, 'S01E01.mkv'))).toBe(true)

    const listed = await smm(['list'])
    expect(listed.code).toBe(0)
    expect(listed.stdout.split('\n').filter(Boolean).map((p) => Path.posix(p))).toEqual([
      Path.posix(to),
    ])

    expect(existsSync(metadataCachePath(userDataDir, Path.posix(from)))).toBe(false)
    expect(existsSync(metadataCachePath(userDataDir, Path.posix(to)))).toBe(true)

    const mm = await getCore().getMediaMetadata(to)
    expect(mm).not.toBeNull()
    expect(mm!.type).toBe('tvshow-folder')
    expect(mm!.mediaFolderPath).toBe(Path.posix(to))
    expect(mm!.tvShow?.id).toBe('84666')
    expect(mm!.mediaFiles).toEqual([
      {
        absolutePath: Path.posix(join(to, 'S01E01.mkv')),
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: Path.posix(join(to, 'S01E02.mkv')),
        seasonNumber: 1,
        episodeNumber: 2,
      },
      {
        absolutePath: Path.posix(join(to, 'S01E03.mkv')),
        seasonNumber: 1,
        episodeNumber: 3,
      },
    ])
  })

  it('renames a pre-initialized movie folder via smm rename', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...movieFolder }, {
      updateMediaMetadata: (mediaMetadata) => {
        const folderPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath!)
        return {
          ...mediaMetadata,
          type: 'movie-folder',
          tvShow: undefined,
          mediaFiles: movieFolder.files.map((file) => ({
            absolutePath: Path.posix(join(folderPath, file)),
          })),
          movie: {
            database: 'TVDB',
            id: '116',
            name: 'The Dark Knight',
          },
        }
      },
    })
    const from = folder.path!
    const to = renamedFolderPath(from, folder.folderName)

    const seeded = await getCore().getMediaMetadata(from)
    expect(seeded?.type).toBe('movie-folder')
    expect(seeded?.movie?.id).toBe('116')
    expect(seeded?.mediaFiles?.[0]?.absolutePath).toBe(
      Path.posix(join(from, 'The Dark Knight [1080P].mkv')),
    )

    const renamed = await smm(['rename', from, to])
    expect(renamed.code, renamed.stderr || renamed.stdout).toBe(0)
    expect(renamed.stdout).toContain(`${Path.posix(from)} → ${Path.posix(to)}`)

    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
    expect(existsSync(join(to, 'The Dark Knight [1080P].mkv'))).toBe(true)

    const listed = await smm(['list'])
    expect(listed.code).toBe(0)
    expect(listed.stdout.split('\n').filter(Boolean).map((p) => Path.posix(p))).toEqual([
      Path.posix(to),
    ])

    const mm = await getCore().getMediaMetadata(to)
    expect(mm).not.toBeNull()
    expect(mm!.type).toBe('movie-folder')
    expect(mm!.mediaFolderPath).toBe(Path.posix(to))
    expect(mm!.movie?.id).toBe('116')
    expect(mm!.tvShow).toBeUndefined()
    expect(mm!.mediaFiles).toEqual([
      {
        absolutePath: Path.posix(join(to, 'The Dark Knight [1080P].mkv')),
      },
    ])
  })

  it('renames a linked episode file (+ associates) via smm rename', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...tvShowFolder })
    const media = folder.path!
    const from = join(media, 'S01E01.mkv')
    const to = join(media, 'S01E01_renamed.mkv')

    const renamed = await smm(['rename', from, to])
    expect(renamed.code, renamed.stderr || renamed.stdout).toBe(0)
    expect(renamed.stdout).toContain(
      `${Path.posix(from)} → ${Path.posix(to)}`,
    )
    expect(renamed.stdout).toContain(
      `${Path.posix(join(media, 'S01E01.jpg'))} → ${Path.posix(join(media, 'S01E01_renamed.jpg'))}`,
    )
    expect(renamed.stdout).toContain(
      `${Path.posix(join(media, 'S01E01.sc.ass'))} → ${Path.posix(join(media, 'S01E01_renamed.sc.ass'))}`,
    )

    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
    expect(existsSync(join(media, 'S01E01_renamed.jpg'))).toBe(true)
    expect(existsSync(join(media, 'S01E01.jpg'))).toBe(false)

    const mm = await getCore().getMediaMetadata(media)
    expect(mm).not.toBeNull()
    expect(mm!.mediaFiles).toEqual(
      expect.arrayContaining([
        {
          absolutePath: Path.posix(to),
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ]),
    )
  })

  it('rejects renaming a subdirectory that is not a managed media folder', async () => {
    const folder = await createAndImportInitializedFolder(mediaDir, { ...tvShowFolder })
    const media = folder.path!
    const season = join(media, 'Season 01')
    mkdirSync(season)

    const result = await smm(['rename', season, join(media, 'Season 01 - Renamed')])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/directory but not a managed media folder/)
  })

  it('rejects unmanaged paths', async () => {
    const orphan = join(mediaDir, 'orphan.mkv')
    const result = await smm(['rename', orphan, join(mediaDir, 'orphan2.mkv')])
    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/not under a managed media folder/)
  })
})
