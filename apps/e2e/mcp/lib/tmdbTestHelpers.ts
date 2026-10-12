import type { UserConfig } from '@smm/types'
import { callTool, type McpCallResult } from './mcpInspectorClient'

export const TV_SEARCH_KEYWORD = '天使降临到我身边'
export const TV_TMDB_ID = 84666
export const MOVIE_TMDB_ID = 552524
export const TV_TITLE_PATTERN = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i

/**
 * TMDB upstream calls are network-dependent and can be slow / flaky on the
 * first request (failover attempts). Retry a bounded number of times.
 */
export async function callTmdbTool(
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

export function applyTmdbUserConfig(): Partial<UserConfig> {
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
