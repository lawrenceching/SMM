import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm rm', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-rm-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-rm-media-'))
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

  it('exits 1 when the folder is not imported', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'rm', mediaFolder])

    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/not imported/i)
  })

  it('unimports the folder and exits 0', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { runCli } = await import('./runCli')
    expect(await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])).toBe(0)
    logSpy.mockClear()
    errorSpy.mockClear()

    const code = await runCli(['node', 'smm', 'rm', mediaFolder])

    expect(code).toBe(0)
    expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(mediaFolder)
    const config = JSON.parse(readFileSync(join(userDataDir, 'smm.json'), 'utf-8')) as {
      folders: string[]
    }
    expect(config.folders).not.toContain(mediaFolder)
  })
})
