import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm show', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-show-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-show-media-'))
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
    const code = await runCli(['node', 'smm', 'show', mediaFolder])

    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/not imported/i)
  })

  it('reports folder_not_found when imported path is missing on disk', async () => {
    const missing = join(mediaFolder, 'gone')
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: [missing] }),
      'utf-8',
    )
    resetCoreForTests()

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'show', missing])

    expect(code).toBe(0)
    const text = output()
    expect(text).toContain(`Path:    ${missing}`)
    expect(text).toContain('Status:  folder_not_found')
  })

  it('reports error_loading_metadata when cache is missing', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: [mediaFolder] }),
      'utf-8',
    )
    resetCoreForTests()

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'show', mediaFolder])

    expect(code).toBe(0)
    const text = output()
    expect(text).toContain(`Path:    ${mediaFolder}`)
    expect(text).toContain('Status:  error_loading_metadata')
  })

  it('reports ok with type after a successful music import', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { runCli } = await import('./runCli')
    expect(await runCli(['node', 'smm', 'add', mediaFolder, '--type', 'music'])).toBe(0)
    logSpy.mockClear()

    const code = await runCli(['node', 'smm', 'show', mediaFolder])

    expect(code).toBe(0)
    const text = output()
    expect(text).toContain(`Path:    ${mediaFolder}`)
    expect(text).toContain('Status:  ok')
    expect(text).toContain('Type:    music-folder')
  })
})
