import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { VideoCaptionerPort, VideoCaptionerRunResult } from '@smm/core'
import { resetCoreForTests } from '@smm/server'
import { processSubtitle } from './processSubtitle'

describe('processSubtitle', () => {
  let userDataDir: string
  let appDataDir: string
  let folder: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-process-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-process-cmd-app-'))
    folder = mkdtempSync(join(tmpdir(), 'smm-process-cmd-out-'))
    process.env.USER_DATA_DIR = userDataDir
    process.env.APP_DATA_DIR = appDataDir
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
    if (prevAppDataDir === undefined) delete process.env.APP_DATA_DIR
    else process.env.APP_DATA_DIR = prevAppDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(appDataDir, { recursive: true, force: true })
    rmSync(folder, { recursive: true, force: true })
  })

  it('returns 0 when VideoCaptionerPort exits 0', async () => {
    const videoCaptioner: VideoCaptionerPort = {
      run: vi.fn(async (): Promise<VideoCaptionerRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }

    const code = await processSubtitle(join(folder, 'clip.mp4'), {
      folder,
      asr: 'bijian',
      noTranslate: true,
      noSynthesize: true,
      _ports: { videoCaptioner },
    })

    expect(code).toBe(0)
    expect(videoCaptioner.run).toHaveBeenCalledOnce()
  })

  it('returns 1 when VideoCaptionerPort exits non-zero', async () => {
    const videoCaptioner: VideoCaptionerPort = {
      run: vi.fn(async (): Promise<VideoCaptionerRunResult> => ({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: process failed',
      })),
    }

    const code = await processSubtitle(join(folder, 'clip.mp4'), {
      folder,
      asr: 'bijian',
      noTranslate: true,
      noSynthesize: true,
      _ports: { videoCaptioner },
    })

    expect(code).toBe(1)
    expect(videoCaptioner.run).toHaveBeenCalledOnce()
  })
})
