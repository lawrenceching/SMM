import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCore, resetCoreForTests } from '../core/getCore'

async function startMusicImportSkipInit(mediaFolder: string): Promise<string> {
  const core = getCore()
  const { id } = await core.importFolder({
    path: mediaFolder,
    type: 'music',
    skipInit: true,
    callbacks: {},
  })
  await core.waitForJobUntilCompleted(id)
  return id
}

async function expectedImportLogLines(id: string): Promise<string[]> {
  const text = await getCore().getJobLog(id)
  return text.split(/\r?\n/).filter((line) => line.length > 0)
}

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
    const id = await startMusicImportSkipInit(mediaFolder)
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', id])
    expect(code).toBe(0)
    const printed = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(printed).toContain(id)
    expect(printed).toContain('"type": "import-folder"')
    expect(printed).toMatch(/"status": "(succeeded|failed)"/)
  })

  it('prints log messages for smm job log', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const id = await startMusicImportSkipInit(mediaFolder)
    const expectedLines = await expectedImportLogLines(id)
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', id])
    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => String(c[0]))
    expect(lines).toEqual(expectedLines)
    expect(lines.some((line) => line.includes('Started to import folder'))).toBe(true)
    expect(lines.some((line) => /^\S+ completed$/.test(line))).toBe(true)
  })

  it('lists a finished import and prints its log after the process is gone', async () => {
    const logDir = mkdtempSync(join(tmpdir(), 'smm-job-logs-'))
    const prevLogDir = process.env.LOG_DIR
    process.env.LOG_DIR = logDir
    try {
      writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
      resetCoreForTests()
      const id = await startMusicImportSkipInit(mediaFolder)
      const expectedLines = await expectedImportLogLines(id)
      resetCoreForTests()

      const { runCli } = await import('./runCli')
      const listCode = await runCli(['node', 'smm', 'job', 'list'])
      expect(listCode).toBe(0)
      expect(logSpy.mock.calls.map((c) => String(c[0]))).toContain(id)

      logSpy.mockClear()
      const logCode = await runCli(['node', 'smm', 'job', 'log', id])
      expect(logCode).toBe(0)
      expect(logSpy.mock.calls.map((c) => String(c[0]))).toEqual(expectedLines)
    } finally {
      if (prevLogDir === undefined) delete process.env.LOG_DIR
      else process.env.LOG_DIR = prevLogDir
      rmSync(logDir, { recursive: true, force: true })
    }
  })

  it('exits 1 for smm job log with unknown id', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', 'missing'])
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('exits 0 for smm job stop on a finished import (Core tryAbort is a no-op)', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const id = await startMusicImportSkipInit(mediaFolder)
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'stop', id])
    expect(code).toBe(0)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
