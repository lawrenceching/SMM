import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { FfmpegPort, FfmpegRunResult } from '@smm/core'
import { resetCoreForTests } from '@smm/server'
import { convert } from './convert'

describe('convert', () => {
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
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-convert-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-convert-cmd-app-'))
    folder = mkdtempSync(join(tmpdir(), 'smm-convert-cmd-out-'))
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

  it('returns 0 when FfmpegPort exits 0', async () => {
    const ffmpeg: FfmpegPort = {
      run: vi.fn(async (): Promise<FfmpegRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }

    const code = await convert(join(folder, 'clip.mkv'), {
      folder,
      output: join(folder, 'clip.mp4'),
      format: 'mp4h264',
      preset: 'balanced',
      _ports: { ffmpeg },
    })

    expect(code).toBe(0)
    expect(ffmpeg.run).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'ffmpeg' }),
      expect.anything(),
    )
  })

  it('returns 1 when FfmpegPort exits non-zero', async () => {
    const ffmpeg: FfmpegPort = {
      run: vi.fn(async (): Promise<FfmpegRunResult> => ({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: convert failed',
      })),
    }

    const code = await convert(join(folder, 'clip.mkv'), {
      folder,
      output: join(folder, 'clip.mp4'),
      format: 'mp4h264',
      preset: 'balanced',
      _ports: { ffmpeg },
    })

    expect(code).toBe(1)
    expect(ffmpeg.run).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'ffmpeg' }),
      expect.anything(),
    )
  })
})
