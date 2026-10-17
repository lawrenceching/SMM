import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { CommandPort, CommandRunResult } from '@smm/core'
import { resetCoreForTests } from '@smm/server'
import { download } from './download'

describe('download', () => {
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
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-download-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-download-cmd-app-'))
    folder = mkdtempSync(join(tmpdir(), 'smm-download-cmd-out-'))
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

  it('returns 0 when CommandPort exits 0', async () => {
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }

    const code = await download('https://www.bilibili.com/video/BV1', {
      folder,
      _ports: { command },
    })

    expect(code).toBe(0)
    expect(command.run).toHaveBeenCalledOnce()
  })

  it('returns 1 when CommandPort exits non-zero', async () => {
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: Unsupported URL: https://mock.invalid/video',
      })),
    }

    const code = await download('https://www.bilibili.com/video/BV1', {
      folder,
      _ports: { command },
    })

    expect(code).toBe(1)
  })

  it('returns 1 for YouTube without cookies', async () => {
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }

    const code = await download('https://www.youtube.com/watch?v=abc', {
      folder,
      _ports: { command },
    })

    expect(code).toBe(1)
    expect(command.run).not.toHaveBeenCalled()
  })

  it('reads --cookies file into cookiesText', async () => {
    const cookiesPath = join(userDataDir, 'cookies.txt')
    writeFileSync(cookiesPath, '# Netscape\n.example.com\tTRUE\t/\tFALSE\t0\tn\tv\n')
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      })),
    }

    const code = await download('https://www.youtube.com/watch?v=abc', {
      folder,
      cookies: cookiesPath,
      _ports: { command },
    })

    expect(code).toBe(0)
    expect(command.run).toHaveBeenCalledOnce()
  })

  it('prints only progress lines when --print-progress-only is set', async () => {
    const command: CommandPort = {
      run: vi.fn(async (req): Promise<CommandRunResult> => {
        req.onStdoutLine?.(
          '{"percent": "37%", "speed": "4096", "eta": "12", "downloaded": "37", "total": "100", "status": "downloading"}',
        )
        await new Promise((r) => setTimeout(r, 250))
        return { exitCode: 0, stdout: '', stderr: '' }
      }),
    }

    const code = await download('https://www.bilibili.com/video/BV1', {
      folder,
      printProgressOnly: true,
      _ports: { command },
    })

    expect(code).toBe(0)
    const progressLines = logSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((line) => line.startsWith('progress percent='))
    expect(progressLines.some((line) => /progress percent=37(\.0+)?\b/.test(line))).toBe(true)
    expect(logSpy.mock.calls.every((c) => String(c[0] ?? '').startsWith('progress '))).toBe(true)
  })
})
