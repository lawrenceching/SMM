import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { Path } from '@smm/utils/path'
import { handleRenameEpisodeFile } from './RenameEpisodeFile'
import { metadataCachePath } from '../../test/helpers/testFolders'
import { installCliTestEnv, restoreCliTestEnv, type CliTestEnv } from '../../test/helpers/cliTestEnv'
import { resetCoreForTests } from '../core/getCore'

vi.mock('@/utils/socketIO', () => ({
  broadcast: vi.fn(),
}))

describe('POST /api/rename-episode-file', () => {
  let env: CliTestEnv
  let mediaDir: string
  let mediaFolder: string
  let app: Hono

  beforeEach(() => {
    env = installCliTestEnv('smm-rename-episode')
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-rename-episode-media-'))
    mediaFolder = join(mediaDir, 'Show')
    mkdirSync(mediaFolder)
    app = new Hono()
    handleRenameEpisodeFile(app)
  })

  afterEach(() => {
    rmSync(mediaDir, { recursive: true, force: true })
    restoreCliTestEnv(env)
  })

  async function post(body: unknown) {
    return app.request('/api/rename-episode-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  function seedImportedTvShow() {
    const video = join(mediaFolder, 'S01E01.mp4')
    const srt = join(mediaFolder, 'S01E01.srt')
    writeFileSync(video, 'v')
    writeFileSync(srt, 's')

    const folderPosix = Path.posix(mediaFolder)
    writeFileSync(
      join(env.userDataDir, 'smm.json'),
      JSON.stringify({
        folders: [mediaFolder],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: 'plex',
      }),
      'utf-8',
    )
    mkdirSync(join(env.appDataDir, 'metadata'), { recursive: true })
    writeFileSync(
      metadataCachePath(env.appDataDir, folderPosix),
      JSON.stringify({
        mediaFolderPath: folderPosix,
        type: 'tvshow-folder',
        mediaFiles: [
          {
            absolutePath: Path.posix(video),
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
        tvShow: {
          database: 'TMDB',
          id: '1',
          name: 'Demo',
          seasons: [
            {
              season: 1,
              name: 'Season 1',
              episodes: [{ season: 1, episode: 1, name: 'Pilot' }],
            },
          ],
        },
      }),
      'utf-8',
    )
    resetCoreForTests()
    return { video, srt }
  }

  it('returns Error Reason when mediaFolder is missing', async () => {
    const res = await post({ from: '/a', to: '/b' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: mediaFolder is required/)
  })

  it('renames episode and associate via Core', async () => {
    const { video, srt } = seedImportedTvShow()
    const to = join(mediaFolder, 'S01E01_renamed.mp4')

    const res = await post({ mediaFolder, from: video, to })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data?: { succeeded: Array<{ from: string; to: string }> }
      error?: string
    }
    expect(json.error).toBeUndefined()
    expect(json.data?.succeeded.length).toBeGreaterThanOrEqual(2)

    expect(existsSync(to)).toBe(true)
    expect(existsSync(video)).toBe(false)
    expect(existsSync(join(mediaFolder, 'S01E01_renamed.srt'))).toBe(true)
    expect(existsSync(srt)).toBe(false)

    const folderPosix = Path.posix(mediaFolder)
    const mm = JSON.parse(
      readFileSync(metadataCachePath(env.appDataDir, folderPosix), 'utf-8'),
    ) as { mediaFiles: Array<{ absolutePath: string }> }
    expect(mm.mediaFiles[0]?.absolutePath).toBe(Path.posix(to))
  })

  it('rejects unlinked files', async () => {
    seedImportedTvShow()
    const orphan = join(mediaFolder, 'orphan.mp4')
    writeFileSync(orphan, 'x')

    const res = await post({
      mediaFolder,
      from: orphan,
      to: join(mediaFolder, 'orphan2.mp4'),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/not a linked episode/i)
  })

  it('renames movie video and associates via Core', async () => {
    const movieDir = join(mediaDir, 'Ne Zha (2019)')
    mkdirSync(movieDir)
    const video = join(movieDir, 'movie.mp4')
    const srt = join(movieDir, 'movie.srt')
    const enSrt = join(movieDir, 'movie.en.srt')
    writeFileSync(video, 'v')
    writeFileSync(srt, 's')
    writeFileSync(enSrt, 'e')

    const folderPosix = Path.posix(movieDir)
    writeFileSync(
      join(env.userDataDir, 'smm.json'),
      JSON.stringify({
        folders: [movieDir],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: 'plex',
      }),
      'utf-8',
    )
    mkdirSync(join(env.appDataDir, 'metadata'), { recursive: true })
    writeFileSync(
      metadataCachePath(env.appDataDir, folderPosix),
      JSON.stringify({
        mediaFolderPath: folderPosix,
        type: 'movie-folder',
        mediaFiles: [{ absolutePath: Path.posix(video) }],
        movie: { database: 'TMDB', id: '615453', name: 'Ne Zha' },
      }),
      'utf-8',
    )
    resetCoreForTests()

    const to = join(movieDir, 'movie_renamed.mp4')
    const res = await post({ mediaFolder: movieDir, from: video, to })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data?: { succeeded: Array<{ from: string; to: string }> }
      error?: string
    }
    expect(json.error).toBeUndefined()
    expect(json.data?.succeeded.length).toBeGreaterThanOrEqual(3)

    expect(existsSync(to)).toBe(true)
    expect(existsSync(video)).toBe(false)
    expect(existsSync(join(movieDir, 'movie_renamed.srt'))).toBe(true)
    expect(existsSync(join(movieDir, 'movie_renamed.en.srt'))).toBe(true)
    expect(existsSync(srt)).toBe(false)
    expect(existsSync(enSrt)).toBe(false)

    const mm = JSON.parse(
      readFileSync(metadataCachePath(env.appDataDir, folderPosix), 'utf-8'),
    ) as { mediaFiles: Array<{ absolutePath: string }> }
    expect(mm.mediaFiles[0]?.absolutePath).toBe(Path.posix(to))
  })
})
