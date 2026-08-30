import type { TVDBv4SearchResult } from '@smm/tvdb4/types'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { getTVDBv4Client, type GetTVDBv4ClientOverrides } from '@/lib/TvdbUtils'
import { readUserConfig } from './readUserConfig'
import { searchInTvdb } from './tvdbV3'

export interface SearchTvdbResponse {
  results: TVDBv4SearchResult[]
  error?: string
}

export interface TvdbSearchRequestOptions {
  signal?: AbortSignal
  overrides?: GetTVDBv4ClientOverrides
}

/**
 * Search TVDB by keyword. When v3 is enabled, calls `POST /api/search-in-tvdb`;
 * otherwise uses the legacy browser-side TVDBv4 client.
 */
export async function searchTvdb(
  keyword: string,
  type: 'series' | 'movie',
  language?: string,
  options?: TvdbSearchRequestOptions,
): Promise<SearchTvdbResponse> {
  if (isSmmV3Enabled()) {
    const body = await searchInTvdb({ keyword, type, language }, options?.signal)
    if (body.error) {
      return { results: [], error: body.error }
    }
    return { results: body.data ?? [] }
  }

  const userConfig = await readUserConfig()
  const tvdb = getTVDBv4Client({
    ...options?.overrides,
    upstreamBaseURL: userConfig?.tvdb?.host?.trim() || options?.overrides?.upstreamBaseURL,
    apiKey: userConfig?.tvdb?.apiKey?.trim() || options?.overrides?.apiKey,
  })
  const envelope = await tvdb.search({ query: keyword.trim(), type, language })
  if (envelope.status === 'success' && Array.isArray(envelope.data)) {
    return { results: envelope.data }
  }
  return { results: [], error: envelope.message ?? 'TVDB search failed' }
}
