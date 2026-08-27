import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createFolderInTestFolder, musicFolder } from '@smm/test'
import { resetCoreForTests } from '../core/getCore'

describe('smm addlib', () => {
  let userDataDir: string
  let libraryPath: string
  let prevUserDataDir: string | undefined
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

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

  it('with --skip-init registers each subfolder without full initialization output', async () => {
    createFolderInTestFolder(libraryPath, musicFolder)
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
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes(`importing library ${libraryPath}`))).toBe(true)
    expect(lines.filter((l) => l.startsWith('imported folder ')).length).toBe(2)
    expect(lines.some((l) => l === 'succeeded')).toBe(false)
    expect(lines.some((l) => l.includes('recognizing'))).toBe(false)
  })

  it('exits 1 when the library path does not exist', async () => {
    const missing = join(libraryPath, 'does-not-exist')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'addlib', missing, '--type', 'music'])

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('treats --type anime as tvshow', async () => {
    const { Core } = await import('core-app')
    const importLibrary = vi
      .spyOn(Core.prototype, 'importLibrary')
      .mockReturnValue({ id: 'lib-job-1' })
    vi.spyOn(Core.prototype, 'getJob').mockReturnValue({
      kind: 'import-library',
      id: 'lib-job-1',
      libraryPath,
      type: 'tvshow',
      status: 'succeeded',
      progress: 100,
      tasks: [],
      createdAt: 0,
      updatedAt: 0,
    })

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'addlib', libraryPath, '--type', 'anime'])

    expect(code).toBe(0)
    expect(importLibrary).toHaveBeenCalledWith(libraryPath, 'tvshow', undefined)
  })
})
