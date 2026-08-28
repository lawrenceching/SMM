import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm list', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-list-cli-'))
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
  })

  it('prints folder paths one per line and exits 0', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/A', '/media/B'] }),
      'utf-8',
    )
    resetCoreForTests()

    const { runListCli } = await import('./list')
    const code = await runListCli(['node', 'smm', 'list'])

    expect(code).toBe(0)
    expect(logSpy.mock.calls.map((c) => c[0])).toEqual(['/media/A', '/media/B'])
  })

  it('prints nothing and exits 0 when there are no folders', async () => {
    const { runListCli } = await import('./list')
    const code = await runListCli(['node', 'smm', 'list'])

    expect(code).toBe(0)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('writes to stderr and exits 1 when getFolders throws', async () => {
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        getFolders: async () => {
          throw new Error('boom')
        },
      }),
      resetCoreForTests: () => {},
    }))

    const { runListCli } = await import('./list')
    const code = await runListCli(['node', 'smm', 'list'])

    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const errText = String(errorSpy.mock.calls[0]?.[0] ?? '')
    expect(errText).toContain('boom')

    vi.doUnmock('../core/getCore')
    vi.resetModules()
  })
})
