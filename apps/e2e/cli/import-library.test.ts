import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFolderInTestFolder, tvShowFolder, folder2, musicFolder } from '@smm/test'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'
import { setup, cleanup, bin } from './base'
import { readUserConfig } from './helpers'
import { runCliHello } from '../test/lib/cli-hello'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000

function metadataCachePath(appDataDir: string, folderPath: string): string {
  const filename = Path.posix(folderPath).replace(/[/\\:?*|<>"]/g, '_')
  return join(appDataDir, 'metadata', `${filename}.json`)
}

async function readCachedMetadata(folderPath: string): Promise<MediaMetadata> {
  const { appDataDir } = await runCliHello(bin)
  const cachePath = metadataCachePath(appDataDir, folderPath)
  expect(existsSync(cachePath), `missing metadata cache: ${cachePath}`).toBe(true)
  return JSON.parse(readFileSync(cachePath, 'utf-8')) as MediaMetadata
}

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
    const show = createFolderInTestFolder(libraryPath, tvShowFolder)
    const unknown = createFolderInTestFolder(libraryPath, {
      ...tvShowFolder,
      folderName: 'UnknownFolder',
      files: ['S01E01.mkv'],
    })
    const [folder1, folder2Path] = readdirSync(libraryPath).map((name) => join(libraryPath, name))

    const ret = await $`${bin} addlib ${libraryPath} --type tvshow
${bin} list
    `.nothrow()

    expect(ret.exitCode).toBe(0)
    const jobId = /^(\d+) started\n/.exec(ret.text())![1]
    const recognizeLinesFor = (folderPath: string): string[] =>
      folderPath === unknown.path
        ? [
            `Recognize ${folderPath}: undefined (undefinedId:undefined)`,
            `Recognize 0 episode files`,
          ]
        : [
            `Recognize ${folderPath}: WATATEN!: an Angel Flew Down to Me (tmdbId:84666)`,
            `Recognize 3 episode files`,
          ]
    expect(ret.text()).toBe(
      `${jobId} started\n` +
        `Found 2 folders to import\n` +
        `Started to import folder: ${folder1}, type: tvshow\n` +
        `${recognizeLinesFor(folder1!).join('\n')}\n` +
        `Started to import folder: ${folder2Path}, type: tvshow\n` +
        `${recognizeLinesFor(folder2Path!).join('\n')}\n` +
        `${jobId} completed\n` +
        `${folder1}\n` +
        `${folder2Path}\n`,
    )

    expect((await readUserConfig(bin)).folders).toEqual([folder1, folder2Path])
    expect(await readCachedMetadata(unknown.path!)).toEqual({
      mediaFolderPath: Path.posix(unknown.path!),
      type: 'tvshow-folder',
      mediaFiles: [],
    })
    expect(await readCachedMetadata(show.path!)).toEqual({
      mediaFolderPath: Path.posix(show.path!),
      type: 'tvshow-folder',
      mediaFiles: [
        {
          absolutePath: Path.posix(join(show.path!, 'S01E01.mkv')),
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          absolutePath: Path.posix(join(show.path!, 'S01E02.mkv')),
          seasonNumber: 1,
          episodeNumber: 2,
        },
        {
          absolutePath: Path.posix(join(show.path!, 'S01E03.mkv')),
          seasonNumber: 1,
          episodeNumber: 3,
        },
      ],
      tvShow: {
        id: '84666',
        name: 'WATATEN!: an Angel Flew Down to Me',
        database: 'TMDB',
        airDate: '2019-01-08',
        seasons: [
          {
            season: 0,
            name: 'Specials',
            episodes: [
              {
                season: 0,
                episode: 1,
                name: "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister",
              },
            ],
          },
          {
            season: 1,
            name: 'Season 1',
            episodes: [
              { season: 1, episode: 1, name: 'A Funny, Squirmy Feeling' },
              { season: 1, episode: 2, name: 'Incontestably Cute' },
              { season: 1, episode: 3, name: 'Imprinting' },
              { season: 1, episode: 4, name: 'Can We Talk for a Moment?' },
              { season: 1, episode: 5, name: "Don't Worry! Leave It to Me!" },
              { season: 1, episode: 6, name: "Mya-nee Doesn't Have Any Friends" },
              { season: 1, episode: 7, name: "I Don't Understand What Mya-nee Is Saying" },
              { season: 1, episode: 8, name: 'Sometimes Ignorance Is Bliss' },
              { season: 1, episode: 9, name: 'Please Stay Until I Fall Asleep' },
              { season: 1, episode: 10, name: 'I Said Too Much Again' },
              { season: 1, episode: 11, name: "In Short, It's Your Fault, Onee-san" },
              { season: 1, episode: 12, name: "Angel's Gaze" },
            ],
          },
        ],
      },
    })
  }, FIVE_MINUTES_MS)

  it('import movie library', async () => {
    const movie = createFolderInTestFolder(libraryPath, folder2)

    const ret = await $`${bin} addlib ${libraryPath} --type movie`.nothrow()

    expect(ret.exitCode).toBe(0)
    const jobId = /^(\d+) started\n/.exec(ret.text())![1]
    expect(ret.text()).toBe(
      `${jobId} started\n` +
        `Found 1 folders to import\n` +
        `Started to import folder: ${movie.path}, type: movie\n` +
        `Recognize ${movie.path}: JUJUTSU KAISEN: Execution (tmdbId:1539104)\n` +
        `Recognize 1 episode files\n` +
        `${jobId} completed\n`,
    )

    expect((await readUserConfig(bin)).folders).toEqual([movie.path])
    expect(await readCachedMetadata(movie.path!)).toEqual({
      mediaFolderPath: Path.posix(movie.path!),
      type: 'movie-folder',
      mediaFiles: [
        {
          absolutePath: Path.posix(join(movie.path!, 'movie.mkv')),
        },
      ],
      movie: {
        id: '1539104',
        name: 'JUJUTSU KAISEN: Execution',
        airDate: '2025-11-07',
        database: 'TMDB',
      },
    })
  }, FIVE_MINUTES_MS)

  it('import music library with --skip-init', async () => {
    const music = createFolderInTestFolder(libraryPath, musicFolder)

    const ret = await $`${bin} addlib ${libraryPath} --type music --skip-init
${bin} list
    `.nothrow()

    expect(ret.exitCode).toBe(0)
    const jobId = /^(\d+) started\n/.exec(ret.text())![1]
    expect(ret.text()).toBe(
      `${jobId} started\n` +
        `Found 1 folders to import\n` +
        `Started to import folder: ${music.path}, type: music\n` +
        `${jobId} completed\n` +
        `${music.path}\n`,
    )

    expect((await readUserConfig(bin)).folders).toEqual([music.path])
    expect(await readCachedMetadata(music.path!)).toEqual({
      mediaFolderPath: Path.posix(music.path!),
      type: 'music-folder',
      mediaFiles: [],
    })
  }, FIVE_MINUTES_MS)
})
