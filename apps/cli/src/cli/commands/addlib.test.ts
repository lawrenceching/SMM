import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'
import { resetCoreForTests } from '../../core/getCore'
import { metadataCachePath } from '../../../test/helpers/testFolders'
import { addlib } from './addlib'

describe('addlib', () => {
  let userDataDir: string
  let appDataDir: string
  let libraryPath: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-addlib-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-addlib-cmd-app-'))
    libraryPath = mkdtempSync(join(tmpdir(), 'smm-addlib-cmd-lib-'))
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
    rmSync(libraryPath, { recursive: true, force: true })
  })

  function createMusicSubfolder(name: string): string {
    const folder = join(libraryPath, name)
    mkdirSync(folder)
    writeFileSync(join(folder, 'track.mp3'), 'x')
    return folder
  }

  function readCachedMetadata(folder: string): MediaMetadata {
    const cachePath = metadataCachePath(appDataDir, Path.posix(folder))
    expect(existsSync(cachePath), `missing metadata cache: ${cachePath}`).toBe(true)
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as MediaMetadata
  }

  it('imports every music subfolder and returns 0', async () => {
    const show1 = createMusicSubfolder('Show1')
    const show2 = createMusicSubfolder('Show2')

    const code = await addlib(libraryPath, { type: 'music', verbose: true })

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toEqual(expect.arrayContaining([show1, show2]))
    expect(config.folders).toHaveLength(2)
    expect(readCachedMetadata(show1)).toEqual({
      mediaFolderPath: Path.posix(show1),
      type: 'music-folder',
      mediaFiles: [],
    })
    expect(readCachedMetadata(show2)).toEqual({
      mediaFolderPath: Path.posix(show2),
      type: 'music-folder',
      mediaFiles: [],
    })
  })

  it('treats anime as tvshow when calling importLibrary', async () => {
    const { Core } = await import('@smm/core')
    const importLibrary = vi.spyOn(Core.prototype, 'importLibrary').mockResolvedValue({ id: 'lib-1' })
    vi.spyOn(Core.prototype, 'getJob').mockReturnValue({
      id: 'lib-1',
      status: 'succeeded',
      type: 'import-library',
      logFilePath: '/logs/lib-1.log',
      progress: () => 100,
      start: async () => {},
      run: async () => {},
      abort: async () => {},
      tryAbort: () => {},
      log: async () => {},
      context: {} as never,
      ports: {} as never,
    } as never)
    vi.spyOn(Core.prototype, 'waitForJobUntilCompleted').mockResolvedValue(undefined)

    const code = await addlib(libraryPath, { type: 'anime' })

    expect(code).toBe(0)
    expect(importLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        path: libraryPath,
        type: 'tvshow',
        skipInit: false,
      }),
    )
  })

  it('returns 1 when the library path does not exist', async () => {
    const missing = join(libraryPath, 'does-not-exist')

    const code = await addlib(missing, { type: 'music' })

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })
})
