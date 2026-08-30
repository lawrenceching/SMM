import { apiFetch } from '@/lib/apiFetch'
import { mediaLanguageToTvdbCode } from '@smm/utils/locale'
import type { PreferMediaLanguage } from '@smm/types'
import type { TVDBv4SearchResult } from '@smm/tvdb4/types'

const PREFER_MEDIA_LANGUAGES = new Set<string>(['zh-CN', 'en-US', 'ja-JP'])

/** Map UI media language (BCP 47) to TVDB ISO 639-3 before calling Core routes. */
export function toTvdbApiLanguage(language?: string): string | undefined {
  const trimmed = language?.trim()
  if (!trimmed) return undefined
  if (PREFER_MEDIA_LANGUAGES.has(trimmed)) {
    return mediaLanguageToTvdbCode(trimmed as PreferMediaLanguage)
  }
  return trimmed
}

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
  const language = toTvdbApiLanguage(options?.language)
  if (language) body.language = language
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
