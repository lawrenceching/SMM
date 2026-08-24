import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetCoreForTests } from '../core/getCore'

describe('smm tmdb search', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-tmdb-cli-'))
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
        searchInTmdb: async () => ({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [
            {
              id: 42,
              name: 'My Show',
              original_name: 'My Show',
              overview: 'A show',
              poster_path: null,
              backdrop_path: null,
              first_air_date: '2020-01-01',
              vote_average: 0,
              vote_count: 0,
              popularity: 0,
              genre_ids: [],
              origin_country: [],
            },
          ],
        }),
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tmdb', 'search', 'keyword', '--type', 'tv'])

    expect(code).toBe(0)
    expect(logSpy.mock.calls.map((c: unknown[]) => c[0])).toEqual(['#1 42 My Show (2020-01-01)\nA show'])
  })

  it('passes host, password, proxy and lang to Core.searchInTmdb', async () => {
    const calls: unknown[] = []
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTmdb: async (keyword: string, options: unknown) => {
          calls.push({ keyword, options })
          return { page: 1, total_pages: 1, total_results: 0, results: [] }
        },
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node',
      'smm',
      'tmdb',
      'search',
      'hello',
      '--type',
      'movie',
      '--host',
      'https://tmdb.example.com/v3',
      '--password',
      'secret',
      '--proxy',
      'socks5://127.0.0.1:1080',
      '--lang',
      'ja-JP',
    ])

    expect(code).toBe(0)
    expect(calls).toEqual([
      {
        keyword: 'hello',
        options: {
          type: 'movie',
          host: 'https://tmdb.example.com/v3',
          password: 'secret',
          proxy: 'socks5://127.0.0.1:1080',
          language: 'ja-JP',
        },
      },
    ])
  })

  it('omits language when --lang is not passed', async () => {
    const calls: unknown[] = []
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTmdb: async (_keyword: string, options: unknown) => {
          calls.push(options)
          return { page: 1, total_pages: 1, total_results: 0, results: [] }
        },
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tmdb', 'search', 'x', '--type', 'tv'])

    expect(code).toBe(0)
    expect(calls[0]).toEqual({
      type: 'tv',
      host: undefined,
      password: undefined,
      proxy: undefined,
      language: undefined,
    })
  })

  it('exits non-zero when --lang is invalid', async () => {
    vi.resetModules()
    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node',
      'smm',
      'tmdb',
      'search',
      'keyword',
      '--type',
      'tv',
      '--lang',
      'cn',
    ])

    expect(code).not.toBe(0)
    const errText = String(errorSpy.mock.calls.flat().join(' '))
    expect(errText).toMatch(/Unsupported language "cn"/)
    expect(errText).toMatch(/--lang zh-CN/)
    expect(errText).not.toMatch(/cn-CN/)
  })

  it('writes to stderr and exits 1 when search throws', async () => {
    vi.resetModules()
    vi.doMock('../core/getCore', () => ({
      getCore: () => ({
        searchInTmdb: async () => {
          throw new Error('network down')
        },
      }),
      resetCoreForTests: () => {},
    }))

    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'tmdb', 'search', 'x', '--type', 'tv'])

    expect(code).toBe(1)
    expect(String(errorSpy.mock.calls[0]?.[0] ?? '')).toContain('network down')
  })
})
