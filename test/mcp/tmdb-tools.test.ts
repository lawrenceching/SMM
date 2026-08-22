import { describe, expect, it } from 'bun:test'
import type { UserConfig } from '@smm/core/types'
import { callTool, type McpCallResult } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { writeUserConfig } from './lib/testSetup'

const TV_SEARCH_KEYWORD = '天使降临到我身边'
const TV_TMDB_ID = 84666
const MOVIE_TMDB_ID = 552524
const TV_TITLE_PATTERN = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i

/**
 * TMDB upstream calls are network-dependent and can be slow / flaky on the
 * first request (failover attempts). Retry a bounded number of times.
 */
async function callTmdbTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  maxAttempts = 3,
): Promise<McpCallResult> {
  let last: McpCallResult | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await callTool(url, toolName, args)
    if (!last.isError) {
      return last
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return last!
}

function applyTmdbUserConfig(): Partial<UserConfig> {
  const tmdb: Record<string, string> = {}
  const host = (process.env.TMDB_HOST || '').trim()
  const apiKey = (process.env.TMDB_API_KEY || '').trim()
  const httpProxy = (process.env.TMDB_HTTP_PROXY || '').trim()
  if (host) tmdb.host = host
  if (apiKey) tmdb.apiKey = apiKey
  // Bun's fetch only supports http/https proxies (not socks5). The SMM MCP
  // server runs under Bun, so a socks5 TMDB_HTTP_PROXY would fail every
  // request; fall back to direct access in that case.
  if (httpProxy && /^https?:\/\//i.test(httpProxy)) {
    tmdb.httpProxy = httpProxy
  }
  return { tmdb }
}

/**
 * MCP TMDB tools (`tmdb-search`, `tmdb-get-movie`, `tmdb-get-tv-show`).
 *
 * Requires TMDB network access (see `.env.local` for `TMDB_HOST` /
 * `TMDB_API_KEY` / `TMDB_HTTP_PROXY`).
 */
describe('MCP Other - TmdbTools', () => {
  const ctx = useMcpServer()

  it('tmdb-search returns TV results', async () => {
    await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
    const r = await callTmdbTool(ctx.url, 'tmdb-search', {
      keyword: TV_SEARCH_KEYWORD,
      type: 'tv',
      language: 'zh-CN',
    })
    expect(r.isError).toBe(false)
    const sc = r.structuredContent!
    expect((sc.results as unknown[]).length).toBeGreaterThan(0)
    expect(sc.page).toBeGreaterThanOrEqual(1)

    const first = (sc.results as Array<{ id: number; name?: string }>)[0]!
    expect(first.id).toBeGreaterThan(0)
    expect(first.name).toMatch(TV_TITLE_PATTERN)
  }, 180_000)

  it('tmdb-get-tv-show returns series details', async () => {
    await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
    const r = await callTmdbTool(ctx.url, 'tmdb-get-tv-show', {
      id: TV_TMDB_ID,
      language: 'zh-CN',
    })
    expect(r.isError).toBe(false)
    const sc = r.structuredContent!
    expect(sc.id).toBe(TV_TMDB_ID)
    expect(String(sc.name)).toMatch(TV_TITLE_PATTERN)
  }, 180_000)

  it('tmdb-get-movie returns movie details', async () => {
    await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
    const r = await callTmdbTool(ctx.url, 'tmdb-get-movie', {
      id: MOVIE_TMDB_ID,
      language: 'zh-CN',
    })
    expect(r.isError).toBe(false)
    const sc = r.structuredContent!
    expect(sc.id).toBe(MOVIE_TMDB_ID)
    expect(typeof sc.title).toBe('string')
    expect(String(sc.title).length).toBeGreaterThan(0)
  }, 180_000)
})
