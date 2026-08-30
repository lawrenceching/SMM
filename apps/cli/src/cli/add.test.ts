import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm add', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-add-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-add-media-'))
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

  it('imports the folder, waits until initialization succeeds, and exits 0', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(mediaFolder)
  })

  it('writes to stderr and exits 1 when initialization fails', async () => {
    const missing = join(mediaFolder, 'does-not-exist')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', missing, '--type', 'music'])

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('exits 1 when --type is missing', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder])

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('treats --type anime as tvshow', async () => {
    const { Core } = await import('@smm/core')
    const importFolder = vi.spyOn(Core.prototype, 'importFolder').mockReturnValue({ id: 'job-1' })
    vi.spyOn(Core.prototype, 'getJob').mockReturnValue({
      kind: 'import',
      id: 'job-1',
      folderPath: mediaFolder,
      type: 'tvshow',
      status: 'succeeded',
      stage: null,
      progress: 100,
      createdAt: 0,
      updatedAt: 0,
    })

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'anime'])

    expect(code).toBe(0)
    expect(importFolder).toHaveBeenCalledWith(mediaFolder, 'tvshow')
  })

  it('prints necessary logs by default', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])

    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes(`imported folder ${mediaFolder}`))).toBe(true)
    expect(lines.some((l) => l === 'succeeded')).toBe(true)
    expect(lines.some((l) => l.includes('importFolder: stage='))).toBe(false)
    expect(lines.some((l) => l.includes('"folderPath"'))).toBe(false)
  })

  it('prints detailed logs with --verbose', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music', '--verbose'])

    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes('importFolder: stage=config'))).toBe(true)
    expect(lines.some((l) => l.includes('folderPath'))).toBe(true)
    expect(lines.some((l) => l === 'succeeded')).toBe(true)
  })

  it('with --skip-init only registers the folder and prints imported folder', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'tvshow', '--skip-init'])

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(mediaFolder)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines).toEqual([`imported folder ${mediaFolder}`])
    expect(lines.some((l) => l === 'succeeded')).toBe(false)
    expect(lines.some((l) => l.includes('recognizing'))).toBe(false)
  })
})
