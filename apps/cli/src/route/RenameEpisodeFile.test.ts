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
import { Path } from '@core/path'
import { handleRenameEpisodeFile } from './RenameEpisodeFile'
import { resetCoreForTests } from '../core/getCore'

vi.mock('@/utils/socketIO', () => ({
  broadcast: vi.fn(),
}))

describe('POST /api/rename-episode-file', () => {
  let userDataDir: string
  let mediaDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-rename-episode-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-rename-episode-media-'))
    mediaFolder = join(mediaDir, 'Show')
    mkdirSync(mediaFolder)
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleRenameEpisodeFile(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaDir, { recursive: true, force: true })
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
      join(userDataDir, 'smm.json'),
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
    const cacheName = folderPosix.replace(/[/\\:?*|<>"]/g, '_')
    mkdirSync(join(userDataDir, 'metadata'), { recursive: true })
    writeFileSync(
      join(userDataDir, 'metadata', `${cacheName}.json`),
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
    const cacheName = folderPosix.replace(/[/\\:?*|<>"]/g, '_')
    const mm = JSON.parse(
      readFileSync(join(userDataDir, 'metadata', `${cacheName}.json`), 'utf-8'),
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
})
