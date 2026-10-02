import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createFolderInTestFolder, musicFolder } from '@smm/test'
import { resetCoreForTests } from '../core/getCore'

describe('smm addlib', () => {
  let userDataDir: string
  let libraryPath: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-addlib-cli-'))
    libraryPath = mkdtempSync(join(tmpdir(), 'smm-addlib-library-'))
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
    rmSync(libraryPath, { recursive: true, force: true })
  })

  it('imports every subfolder in a library and exits 0', async () => {
    const music1 = createFolderInTestFolder(libraryPath, musicFolder)
    createFolderInTestFolder(libraryPath, {
      ...musicFolder,
      folderName: 'SecondMusic',
    })

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'addlib', libraryPath, '--type', 'music'])

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(music1.path)
    expect(config.folders.length).toBe(2)
  }, 30_000)

  it('with --skip-init registers each subfolder and exits 0', async () => {
    const music1 = createFolderInTestFolder(libraryPath, musicFolder)
    createFolderInTestFolder(libraryPath, {
      ...musicFolder,
      folderName: 'SecondMusic',
    })

    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node',
      'smm',
      'addlib',
      libraryPath,
      '--type',
      'music',
      '--skip-init',
    ])

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(music1.path)
    expect(config.folders.length).toBe(2)
  }, 30_000)

  it('exits 1 when the library path does not exist', async () => {
    const missing = join(libraryPath, 'does-not-exist')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'addlib', missing, '--type', 'music'])

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('treats --type anime as tvshow', async () => {
    const { Core } = await import('@smm/core')
    const importLibrary = vi
      .spyOn(Core.prototype, 'importLibrary')
      .mockResolvedValue({ id: 'lib-job-1' })
    vi.spyOn(Core.prototype, 'getJob').mockReturnValue({
      id: 'lib-job-1',
      status: 'succeeded',
      type: 'import-library',
      logFilePath: '/logs/lib-job-1.log',
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

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'addlib', libraryPath, '--type', 'anime'])

    expect(code).toBe(0)
    expect(importLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        path: libraryPath,
        type: 'tvshow',
        skipInit: false,
      }),
    )
  })
})
