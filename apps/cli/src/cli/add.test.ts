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
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

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
    const job = { status: 'succeeded' as const }
    const importFolder = vi.spyOn(Core.prototype, 'importFolder').mockResolvedValue({ id: 'job-1' })
    vi.spyOn(Core.prototype, 'getJob').mockReturnValue(job as never)
    vi.spyOn(Core.prototype, 'waitForJobUntilCompleted').mockResolvedValue(undefined)

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'anime'])

    expect(code).toBe(0)
    expect(importFolder).toHaveBeenCalledWith(
      expect.objectContaining({
        path: mediaFolder,
        type: 'tvshow',
        skipInit: false,
        callbacks: expect.objectContaining({ onLog: expect.any(Function) }),
      }),
    )
  })

  it('prints necessary logs by default', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])

    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes('Started to import folder:') && l.includes('type: music'))).toBe(
      true,
    )
    expect(lines.some((l) => /^\S+ completed$/.test(l))).toBe(true)
    expect(lines.some((l) => l.includes('importFolder: stage='))).toBe(false)
    expect(lines.some((l) => l.includes('"folderPath"'))).toBe(false)
    expect(lines.some((l) => l.includes(`imported folder ${mediaFolder}`))).toBe(false)
  })

  it('prints detailed logs with --verbose', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music', '--verbose'])

    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes('importFolder: stage=persistFolder'))).toBe(true)
    expect(lines.some((l) => l.includes('folderPath'))).toBe(true)
    expect(lines.some((l) => /^\S+ completed$/.test(l))).toBe(true)
  })

  it('with --skip-init only registers the folder and prints job log lines', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music', '--skip-init'])

    expect(code).toBe(0)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).toContain(mediaFolder)
    const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines.some((l) => l.includes('Started to import folder:') && l.includes('type: music'))).toBe(
      true,
    )
    expect(lines.some((l) => /^\S+ completed$/.test(l))).toBe(true)
    expect(lines.some((l) => l.includes(`imported folder ${mediaFolder}`))).toBe(false)
  })
})
