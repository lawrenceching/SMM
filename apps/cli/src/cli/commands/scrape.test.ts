import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../../core/getCore'
import { scrape } from './scrape'

describe('scrape', () => {
  let userDataDir: string
  let appDataDir: string
  let prevUserDataDir: string | undefined
  let prevAppDataDir: string | undefined
  let logSpy: MockInstance<(...args: unknown[]) => void>
  let errorSpy: MockInstance<(...args: unknown[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    prevAppDataDir = process.env.APP_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-scrape-cmd-'))
    appDataDir = mkdtempSync(join(tmpdir(), 'smm-scrape-cmd-app-'))
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
  })

  it('returns 1 when the folder is not managed', async () => {
    const code = await scrape(join(userDataDir, 'missing'), {})

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/not managed by SMM/))
  })
})
