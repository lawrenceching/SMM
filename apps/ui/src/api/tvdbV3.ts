import { apiFetch } from '@/lib/apiFetch'
import type { TVDBv4SearchResult } from '@smm/tvdb4/types'

export interface TvdbCoreRequestOptions {
  language?: string
  host?: string
  password?: string
  proxy?: string
}

export interface SearchInTvdbParams extends TvdbCoreRequestOptions {
  keyword: string
  type: 'series' | 'movie'
}

export interface SearchInTvdbResponseBody {
  data?: TVDBv4SearchResult[]
  error?: string
}

function optionalFields(options?: TvdbCoreRequestOptions): Record<string, string> {
  const body: Record<string, string> = {}
  if (options?.language) body.language = options.language
  if (options?.host) body.host = options.host
  if (options?.password) body.password = options.password
  if (options?.proxy) body.proxy = options.proxy
  return body
}

async function postTvdb<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const resp = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as T
}

/** `POST /api/search-in-tvdb` → `Core.searchInTvdb`. */
export async function searchInTvdb(
  params: SearchInTvdbParams,
  signal?: AbortSignal,
): Promise<SearchInTvdbResponseBody> {
  return postTvdb<SearchInTvdbResponseBody>(
    '/api/search-in-tvdb',
    {
      keyword: params.keyword,
      type: params.type,
      ...optionalFields(params),
    },
    signal,
  )
}
