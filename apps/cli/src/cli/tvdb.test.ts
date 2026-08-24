import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm tvdb search', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-tvdb-cli-'))
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
    vi.doUnmock('../core/getCore')
    vi.resetModules()
  })

  it('prints formatted results and exits 0', async () => {
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTvdb: async () => [
          { id: 'series-42', objectID: 'series-42', tvdb_id: '42', name: 'My Show', overview: 'A show', first_air_time: '2020-01-01' },
        ],
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tvdb', 'search', 'keyword', '--type', 'series'])

    expect(code).toBe(0)
    expect(logSpy.mock.calls.map((c) => c[0])).toEqual(['#1 42 My Show (2020-01-01)\nA show'])
  })

  it('passes host, password, proxy and lang to Core.searchInTvdb', async () => {
    const calls: unknown[] = []
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTvdb: async (keyword: string, options: unknown) => {
          calls.push({ keyword, options })
          return []
        },
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node', 'smm', 'tvdb', 'search', 'hello', '--type', 'movie',
      '--host', 'https://tvdb.example.com/v4', '--password', 'secret',
      '--proxy', 'socks5://127.0.0.1:1080', '--lang', 'zho',
    ])

    expect(code).toBe(0)
    expect(calls).toEqual([
      {
        keyword: 'hello',
        options: { type: 'movie', host: 'https://tvdb.example.com/v4', password: 'secret', proxy: 'socks5://127.0.0.1:1080', language: 'zho' },
      },
    ])
  })

  it('exits non-zero when --lang is invalid', async () => {
    vi.resetModules()
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tvdb', 'search', 'keyword', '--type', 'series', '--lang', 'zh-CN'])
    expect(code).not.toBe(0)
    expect(String(errorSpy.mock.calls.flat().join(' '))).toMatch(/ISO 639-3/)
  })

  it('writes to stderr and exits 1 when search throws', async () => {
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTvdb: async () => { throw new Error('network down') },
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tvdb', 'search', 'x', '--type', 'series'])
    expect(code).toBe(1)
    expect(String(errorSpy.mock.calls[0]?.[0] ?? '')).toContain('network down')
  })
})
