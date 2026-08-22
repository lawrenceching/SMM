import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests, smm } from './helpers/smm'
import { loadEnvLocal, requiredEnv } from './helpers/loadEnvLocal'

loadEnvLocal(import.meta.dirname)

const TMDB_SEARCH_TIMEOUT_MS = 60_000
const RESULT_HEADER = /^#1 \d+ .+ \(\d{4}(-\d{2}-\d{2})?\)$/m
const TV_TITLE = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i

function officialTmdb(): { host: string; password: string; proxy: string } {
  return {
    host: requiredEnv('TMDB_HOST'),
    password: requiredEnv('TMDB_API_KEY'),
    proxy: requiredEnv('TMDB_HTTP_PROXY'),
  }
}

describe('smm tmdb search CLI e2e (docs/dev/tmdb.md scenarios)', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-tmdb-e2e-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it(
    '1) Search through SMM-provided TMDB host',
    { timeout: TMDB_SEARCH_TIMEOUT_MS },
    async () => {
      const result = await smm(['tmdb', 'search', '天使降临到我身边', '--type', 'tv'])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(TV_TITLE)
    },
  )

  it(
    '2) Search through SMM-provided TMDB host and HTTP/SOCKS proxy',
    { timeout: TMDB_SEARCH_TIMEOUT_MS },
    async () => {
      const { proxy } = officialTmdb()
      const result = await smm([
        'tmdb',
        'search',
        '天使降临到我身边',
        '--type',
        'tv',
        '--proxy',
        proxy,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(TV_TITLE)
    },
  )

  it(
    '3) Search through custom TMDB host',
    { timeout: TMDB_SEARCH_TIMEOUT_MS },
    async () => {
      // Official TMDB rejects unauthenticated search; --password is required for this host.
      const { host, password } = officialTmdb()
      const result = await smm([
        'tmdb',
        'search',
        '天使降临到我身边',
        '--type',
        'tv',
        '--host',
        host,
        '--password',
        password,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(TV_TITLE)
    },
  )

  it(
    '4) Search through custom TMDB host and password',
    { timeout: TMDB_SEARCH_TIMEOUT_MS },
    async () => {
      const { host, password } = officialTmdb()
      const result = await smm([
        'tmdb',
        'search',
        '天使降临到我身边',
        '--type',
        'tv',
        '--host',
        host,
        '--password',
        password,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(TV_TITLE)
    },
  )

  it(
    '5) Search through custom TMDB host, password and HTTP proxy',
    { timeout: TMDB_SEARCH_TIMEOUT_MS },
    async () => {
      const { host, password, proxy } = officialTmdb()
      const result = await smm([
        'tmdb',
        'search',
        '天使降临到我身边',
        '--type',
        'tv',
        '--host',
        host,
        '--password',
        password,
        '--proxy',
        proxy,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(TV_TITLE)
    },
  )
})
