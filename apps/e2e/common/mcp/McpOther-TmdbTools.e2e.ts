import { expect } from '@wdio/globals'
import type { UserConfig } from '@smm/core/types'
import mcpClient from 'test/lib/McpClient'
import { cleanup, getConfiguredHttpProxyAddress, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

const TV_SEARCH_KEYWORD = '天使降临到我身边'
const TV_TMDB_ID = 84666
const MOVIE_TMDB_ID = 552524
const TV_TITLE_PATTERN = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i

function applyTmdbUserConfig(config: UserConfig): UserConfig {
  const host = (process.env.TMDB_HOST || '').trim()
  const apiKey = (process.env.TMDB_API_KEY || '').trim()
  const httpProxy = getConfiguredHttpProxyAddress('tmdb')
  if (host || apiKey || httpProxy) {
    config.tmdb = {
      ...(host ? { host } : {}),
      ...(apiKey ? { apiKey } : {}),
      ...(httpProxy ? { httpProxy } : {}),
    }
  }
  return config
}

/**
 * MCP TMDB tools (`tmdb-search`, `tmdb-get-movie`, `tmdb-get-tv-show`) via Core v3.
 *
 * Requires TMDB network access (see `apps/e2e/.env.local` for `TMDB_HOST` /
 * `TMDB_API_KEY` / `TMDB_HTTP_PROXY` when the default host is blocked).
 *
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('MCP Other - TmdbTools', () => {
  const ctx = createMcpSpecContext()

  before(function () {
    skipIfOhos(this)
  })

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: applyTmdbUserConfig,
      openBrowserPage: true,
      os: testbedOs,
    })
    await setupMcpTest()
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
      os: testbedOs,
    })
  })

  it('tmdb-search returns TV results', async function () {
    this.timeout(120_000)

    const result = await mcpClient.tmdbSearch(ctx.clientCwd, ctx.mcpAddress, {
      keyword: TV_SEARCH_KEYWORD,
      type: 'tv',
      language: 'zh-CN',
    })

    expect(result.results?.length).toBeGreaterThan(0)
    expect(result.page).toBeGreaterThanOrEqual(1)

    const first = result.results[0]!
    expect(first.id).toBeGreaterThan(0)
    expect(first.name).toMatch(TV_TITLE_PATTERN)
  })

  it('tmdb-get-tv-show returns series details', async function () {
    this.timeout(120_000)

    const result = await mcpClient.tmdbGetTvShow(ctx.clientCwd, ctx.mcpAddress, {
      id: TV_TMDB_ID,
      language: 'zh-CN',
    })

    expect(result.id).toBe(TV_TMDB_ID)
    expect(result.name).toMatch(TV_TITLE_PATTERN)
  })

  it('tmdb-get-movie returns movie details', async function () {
    this.timeout(120_000)

    const result = await mcpClient.tmdbGetMovie(ctx.clientCwd, ctx.mcpAddress, {
      id: MOVIE_TMDB_ID,
      language: 'zh-CN',
    })

    expect(result.id).toBe(MOVIE_TMDB_ID)
    expect(typeof result.title).toBe('string')
    expect(result.title!.length).toBeGreaterThan(0)
  })
})
