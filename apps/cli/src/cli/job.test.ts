import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCore, resetCoreForTests } from '../core/getCore'

describe('smm job', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-job-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-job-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaFolder, { recursive: true, force: true })
  })

  it('prints job JSON for smm job <id>', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', id])
    expect(code).toBe(0)
    const printed = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(printed).toContain(id)
    expect(printed).toContain('"kind": "import"')
  })

  it('prints log messages for smm job log', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', id])
    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => String(c[0]))
    expect(lines).toEqual(['persisted folder', 'skipped init'])
  })

  it('exits 1 for smm job log with unknown id', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', 'missing'])
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('exits 1 for smm job stop on a finished import', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'stop', id])
    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'Job already finished',
    )
  })
})
