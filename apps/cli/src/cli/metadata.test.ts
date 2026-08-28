import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm metadata', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-meta-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-meta-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.restoreAllMocks()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaFolder, { recursive: true, force: true })
  })

  function output(): string {
    return logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
  }

  it('exits 1 when the folder is not imported', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'metadata', mediaFolder])

    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/not imported/i)
  })

  it('exits 1 when metadata cache is missing', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: [mediaFolder] }),
      'utf-8',
    )
    resetCoreForTests()

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'metadata', mediaFolder])

    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
      /No metadata cache/i,
    )
  })

  it('writes metadata from --set JSON after skip-init add', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { runCli } = await import('./runCli')
    expect(await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music', '--skip-init'])).toBe(0)
    logSpy.mockClear()
    errorSpy.mockClear()

    const jsonFile = join(userDataDir, 'mm.json')
    writeFileSync(
      jsonFile,
      JSON.stringify({
        type: 'music-folder',
        mediaFiles: [{ absolutePath: join(mediaFolder, 'track.mp3') }],
      }),
      'utf-8',
    )

    expect(await runCli(['node', 'smm', 'metadata', mediaFolder, '--set', jsonFile])).toBe(0)
    logSpy.mockClear()

    expect(await runCli(['node', 'smm', 'metadata', mediaFolder])).toBe(0)
    const text = output()
    expect(text).toContain('type: music-folder')
    expect(text).toContain('mediaFiles:')
    expect(text).not.toContain('(empty)')
  })

  it('prints human-readable metadata after a successful music import', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { runCli } = await import('./runCli')
    expect(await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])).toBe(0)
    logSpy.mockClear()
    errorSpy.mockClear()

    const code = await runCli(['node', 'smm', 'metadata', mediaFolder])

    expect(code).toBe(0)
    const text = output()
    expect(text).toContain('mediaFolderPath:')
    expect(text).toContain('type: music-folder')
    expect(text).toContain('mediaFiles:')
    expect(text).not.toContain('files:')
  })

  it('prints tvShow and mediaFiles fields when present', async () => {
    const { formatMediaMetadata } = await import('./folderDisplay')
    const lines = formatMediaMetadata(mediaFolder, {
      mediaFolderPath: '/media/Show',
      type: 'tvshow-folder',
      tvShow: {
        database: 'TMDB',
        id: '42',
        name: 'Demo Show',
        airDate: '2024-01-01',
        seasons: [
          {
            season: 1,
            name: 'Season 1',
            episodes: [{ season: 1, episode: 1, name: 'Pilot' }],
          },
        ],
      },
      mediaFiles: [
        {
          absolutePath: '/media/Show/S01E01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    })
    const text = lines.join('\n')
    expect(text).toContain('mediaFolderPath:')
    expect(text).toContain('type: tvshow-folder')
    expect(text).toContain('tvShow:')
    expect(text).toContain('name: Demo Show')
    expect(text).toContain('mediaFiles:')
    expect(text).toContain('seasonNumber: 1')
    expect(text).not.toContain('files:')
    expect(text).not.toContain('(unrecognized)')
  })

  it('omits absent fields and never invents unrecognized placeholders', async () => {
    const { formatMediaMetadata } = await import('./folderDisplay')
    const lines = formatMediaMetadata(mediaFolder, {
      mediaFolderPath: '/media/Show',
      type: 'tvshow-folder',
      mediaFiles: [],
    })
    const text = lines.join('\n')
    expect(text).toContain('type: tvshow-folder')
    expect(text).toContain('mediaFiles:')
    expect(text).toContain('(empty)')
    expect(text).not.toContain('tvShow:')
    expect(text).not.toContain('movie:')
    expect(text).not.toContain('(unrecognized)')
  })
})
