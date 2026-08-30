import { apiFetch } from '@/lib/apiFetch'
import type {
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeriesDetails,
} from '@smm/types'

export interface TmdbCoreRequestOptions {
  language?: string
  host?: string
  password?: string
  proxy?: string
}

export interface SearchInTmdbParams extends TmdbCoreRequestOptions {
  keyword: string
  type: 'tv' | 'movie'
}

export interface GetTmdbByIdParams extends TmdbCoreRequestOptions {
  id: number
}

export interface SearchInTmdbResponseBody {
  data?: TmdbSearchResponseBody
  error?: string
}

export interface GetMovieInTmdbResponseBody {
  data?: TmdbMovieDetails
  error?: string
}

export interface GetTvShowInTmdbResponseBody {
  data?: TmdbSeriesDetails
  error?: string
}

function optionalFields(options?: TmdbCoreRequestOptions): Record<string, string> {
  const body: Record<string, string> = {}
  if (options?.language) body.language = options.language
  if (options?.host) body.host = options.host
  if (options?.password) body.password = options.password
  if (options?.proxy) body.proxy = options.proxy
  return body
}

async function postTmdb<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
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

/** `POST /api/search-in-tmdb` → `Core.searchInTmdb`. */
export async function searchInTmdb(
  params: SearchInTmdbParams,
  signal?: AbortSignal,
): Promise<SearchInTmdbResponseBody> {
  return postTmdb<SearchInTmdbResponseBody>(
    '/api/search-in-tmdb',
    {
      keyword: params.keyword,
      type: params.type,
      ...optionalFields(params),
    },
    signal,
  )
}

/** `POST /api/get-movie-in-tmdb` → `Core.getMovieInTmdb`. */
export async function getMovieInTmdb(
  params: GetTmdbByIdParams,
  signal?: AbortSignal,
): Promise<GetMovieInTmdbResponseBody> {
  return postTmdb<GetMovieInTmdbResponseBody>(
    '/api/get-movie-in-tmdb',
    { id: params.id, ...optionalFields(params) },
    signal,
  )
}

/** `POST /api/get-tvshow-in-tmdb` → `Core.getTvShowInTmdb`. */
export async function getTvShowInTmdb(
  params: GetTmdbByIdParams,
  signal?: AbortSignal,
): Promise<GetTvShowInTmdbResponseBody> {
  return postTmdb<GetTvShowInTmdbResponseBody>(
    '/api/get-tvshow-in-tmdb',
    { id: params.id, ...optionalFields(params) },
    signal,
  )
}
