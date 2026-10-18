import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { FfmpegPort, FfmpegRunRequest, FfmpegRunResult } from '@smm/core'
import { resetCoreForTests } from '@smm/server'
import { compress } from './compress'

const FFPROBE_STDOUT = JSON.stringify({
  format: { duration: '10.0' },
  streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
})

describe('compress', () => {
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
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-compress-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-compress-cmd-app-'))
    folder = mkdtempSync(join(tmpdir(), 'smm-compress-cmd-out-'))
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

  it('returns 0 when FfmpegPort exits 0 (ffprobe then ffmpeg)', async () => {
    const ffmpeg: FfmpegPort = {
      run: vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
        if (req.command === 'ffprobe') {
          return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: '' }
        }
        return { exitCode: 0, stdout: '', stderr: '' }
      }),
    }

    const code = await compress(join(folder, 'clip.mkv'), {
      folder,
      output: join(folder, 'clip.mp4'),
      container: 'mp4',
      _ports: { ffmpeg },
    })

    expect(code).toBe(0)
    const calls = vi.mocked(ffmpeg.run).mock.calls
    expect(calls[0]?.[0].command).toBe('ffprobe')
    expect(calls.some((c) => c[0].command === 'ffmpeg')).toBe(true)
  })

  it('returns 1 when FfmpegPort exits non-zero', async () => {
    const ffmpeg: FfmpegPort = {
      run: vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
        if (req.command === 'ffprobe') {
          return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: '' }
        }
        return { exitCode: 1, stdout: '', stderr: 'ERROR: compress failed' }
      }),
    }

    const code = await compress(join(folder, 'clip.mkv'), {
      folder,
      output: join(folder, 'clip.mp4'),
      container: 'mp4',
      _ports: { ffmpeg },
    })

    expect(code).toBe(1)
    const calls = vi.mocked(ffmpeg.run).mock.calls
    expect(calls[0]?.[0].command).toBe('ffprobe')
    expect(calls.some((c) => c[0].command === 'ffmpeg')).toBe(true)
  })
})
