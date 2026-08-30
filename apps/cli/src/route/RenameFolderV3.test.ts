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
import { handleRenameFolderV3 } from './RenameFolderV3'
import { metadataCachePath } from '../../test/helpers/testFolders'
import { installCliTestEnv, restoreCliTestEnv, type CliTestEnv } from '../../test/helpers/cliTestEnv'
import { resetCoreForTests } from '../core/getCore'

vi.mock('@/events/userConfigUpdatedEvent', () => ({
  broadcastUserConfigFolderRenamedEvent: vi.fn(),
}))
vi.mock('@/utils/socketIO', () => ({
  broadcast: vi.fn(),
}))

describe('POST /api/rename-folder', () => {
  let env: CliTestEnv
  let mediaDir: string
  let app: Hono

  beforeEach(() => {
    env = installCliTestEnv('smm-rename-folder-v3')
    mediaDir = mkdtempSync(join(tmpdir(), 'smm-rename-folder-v3-media-'))
    app = new Hono()
    handleRenameFolderV3(app)
  })

  afterEach(() => {
    rmSync(mediaDir, { recursive: true, force: true })
    restoreCliTestEnv(env)
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
      join(env.userDataDir, 'smm.json'),
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
    mkdirSync(join(env.appDataDir, 'metadata'), { recursive: true })
    writeFileSync(
      metadataCachePath(env.appDataDir, fromPosix),
      JSON.stringify({
        mediaFolderPath: fromPosix,
        type: 'tvshow-folder',
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

    const saved = JSON.parse(readFileSync(join(env.userDataDir, 'smm.json'), 'utf-8')) as {
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
      join(env.userDataDir, 'smm.json'),
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
