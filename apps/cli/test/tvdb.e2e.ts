import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetCoreForTests, smm } from './helpers/smm'
import { loadEnvLocal, requiredEnv } from './helpers/loadEnvLocal'

loadEnvLocal(import.meta.dirname)

const TVDB_SEARCH_TIMEOUT_MS = 60_000
const RESULT_HEADER = /^#1 \d+ .+ \(\d{4}(-\d{2}-\d{2})?\)$/m
const SERIES_TITLE = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i

function officialTvdb(): { host: string; password: string; proxy: string } {
  return {
    host: requiredEnv('TVDB_HOST'),
    password: requiredEnv('TVDB_API_KEY'),
    proxy: requiredEnv('TVDB_HTTP_PROXY'),
  }
}

describe('smm tvdb search CLI e2e (docs/dev/tvdb.md scenarios)', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-cli-tvdb-e2e-'))
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
    '1) Search through SMM-provided TVDB host',
    { timeout: TVDB_SEARCH_TIMEOUT_MS },
    async () => {
      const result = await smm(['tvdb', 'search', '天使降临到我身边', '--type', 'series'])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(SERIES_TITLE)
    },
  )

  it(
    '2) Search through SMM-provided TVDB host and HTTP/SOCKS proxy',
    { timeout: TVDB_SEARCH_TIMEOUT_MS },
    async () => {
      const { proxy } = officialTvdb()
      const result = await smm([
        'tvdb', 'search', '天使降临到我身边', '--type', 'series', '--proxy', proxy,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(SERIES_TITLE)
    },
  )

  it(
    '3) Search through custom TVDB host with password and proxy',
    { timeout: TVDB_SEARCH_TIMEOUT_MS },
    async () => {
      const { host, password, proxy } = officialTvdb()
      const result = await smm([
        'tvdb', 'search', '天使降临到我身边', '--type', 'series',
        '--host', host, '--password', password, '--proxy', proxy,
      ])
      expect(result.code, result.stderr || result.stdout).toBe(0)
      expect(result.stdout).toMatch(RESULT_HEADER)
      expect(result.stdout).toMatch(SERIES_TITLE)
    },
  )
})
