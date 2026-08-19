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
import { handleRenameFolderV3 } from './RenameFolderV3'
import { resetCoreForTests } from '../core/getCore'

vi.mock('@/events/userConfigUpdatedEvent', () => ({
  broadcastUserConfigFolderRenamedEvent: vi.fn(),
}))
vi.mock('@/utils/socketIO', () => ({
  broadcast: vi.fn(),
}))

describe('POST /api/rename-folder', () => {
  let userDataDir: string
  let mediaDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-rename-folder-v3-ud-'))
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-rename-folder-v3-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleRenameFolderV3(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaDir, { recursive: true, force: true })
  })

  async function post(body: unknown) {
    return app.request('/api/rename-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('renames via Core and returns data.from/to', async () => {
    const from = join(mediaDir, 'Show')
    const to = join(mediaDir, 'Show Renamed')
    mkdirSync(from)
    writeFileSync(join(from, 'S01E01.mkv'), '')

    const fromPosix = Path.posix(from)
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({
        folders: [from],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: 'plex',
      }),
      'utf-8',
    )
    const cacheName = fromPosix.replace(/[/\\:?*|<>"]/g, '_')
    const cacheDir = join(userDataDir, 'metadata')
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      join(cacheDir, `${cacheName}.json`),
      JSON.stringify({
        mediaFolderPath: fromPosix,
        type: 'tvshow-folder',
        files: [Path.posix(join(from, 'S01E01.mkv'))],
        mediaFiles: [{ absolutePath: Path.posix(join(from, 'S01E01.mkv')) }],
      }),
      'utf-8',
    )
    resetCoreForTests()

    const res = await post({ from, to })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { from, to } })

    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
    expect(existsSync(join(to, 'S01E01.mkv'))).toBe(true)

    const saved = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(saved.folders.map((f) => Path.posix(f))).toEqual([Path.posix(to)])
  })

  it('returns Error Reason when from/to missing', async () => {
    const res = await post({ from: '/a' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason:/)
  })

  it('returns Error Reason when folder is not managed', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({
        folders: [],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: 'plex',
      }),
      'utf-8',
    )
    resetCoreForTests()

    const res = await post({ from: '/media/Missing', to: '/media/X' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/not managed by SMM/)
  })
})
