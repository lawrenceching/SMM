import type { TVDBv4SearchResult } from '@smm/tvdb4/types'
import { searchInTvdb } from './tvdbV3'

export interface SearchTvdbResponse {
  results: TVDBv4SearchResult[]
  error?: string
}

export interface TvdbSearchRequestOptions {
  signal?: AbortSignal
}

/**
 * Search TVDB by keyword via `POST /api/search-in-tvdb`.
 */
export async function searchTvdb(
  keyword: string,
  type: 'series' | 'movie',
  language?: string,
  options?: TvdbSearchRequestOptions,
): Promise<SearchTvdbResponse> {
  const body = await searchInTvdb({ keyword, type, language }, options?.signal)
  if (body.error) {
    return { results: [], error: body.error }
  }
  return { results: body.data ?? [] }
}
