import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'
import { resetCoreForTests } from '@smm/server'
import { metadataCachePath } from '@smm/test'
import { add } from './add'

describe('add', () => {
  let userDataDir: string
  let appDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-add-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-add-cmd-app-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-add-cmd-media-'))
    process.env.USER_DATA_DIR = userDataDir
    process.env.APP_DATA_DIR = appDataDir
    resetCoreForTests()
    const realLog = console.log.bind(console)
    const realError = console.error.bind(console)
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      realLog(...args)
    })
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      realError(...args)
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.restoreAllMocks()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    if (prevAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = prevAppDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(appDataDir, { recursive: true, force: true })
    rmSync(mediaFolder, { recursive: true, force: true })
  })

  function readCachedMetadata(folder: string): MediaMetadata {
    const cachePath = metadataCachePath(appDataDir, Path.posix(folder))
    expect(existsSync(cachePath), `missing metadata cache: ${cachePath}`).toBe(true)
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as MediaMetadata
  }

  it('imports a music folder and returns 0', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const code = await add(mediaFolder, { type: 'music', verbose: true })

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(mediaFolder)
    expect(readCachedMetadata(mediaFolder)).toEqual({
      mediaFolderPath: Path.posix(mediaFolder),
      type: 'music-folder',
      mediaFiles: [],
    })
  })

  it('imports a tvshow folder', async () => {
    writeFileSync(join(mediaFolder, 'S01E01.mkv'), 'x')

    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      text: async () => JSON.stringify({ results: [] }),
      json: async <T>() => ({ results: [] }) as T,
      arrayBuffer: async () => new ArrayBuffer(0),
    }))

    const code = await add(mediaFolder, {
      type: 'tvshow',
      verbose: true,
      _context: { osLocale: 'en-US' },
      _ports: { network: { fetch } },
    })

    expect(code).toBe(0)
    expect(fetch).toHaveBeenCalled()
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(mediaFolder)
    // Mocked network returns no match, so metadata stays blank (no tvShow / linked episodes).
    expect(readCachedMetadata(mediaFolder)).toEqual({
      mediaFolderPath: Path.posix(mediaFolder),
      type: 'tvshow-folder',
      mediaFiles: [],
    })
  })
})
