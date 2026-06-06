import type {
  TmdbSearchResponseBody,
  TmdbMovieDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
} from '@core/types'
export const SMM_TMDB_DEFAULT_UPSTREAM = 'https://tmdb-mcp-server.imlc.me/api/tmdb'

export interface TmdbUpstream {
  reverseProxyUrl: string
  upstreamBaseURL: string
  apiKey?: string
}

export type {
  TmdbTvSeasonDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
  TmdbMovieDetails,
} from '@core/types'

/**
 * Optional overrides for a single TMDB request.
 * The caller should pass connection values from UI config/hooks.
 */
export interface TmdbRequestOptions {
  /**
   * Reverse proxy base URL discovered via the hello task
   * (e.g. `http://127.0.0.1:30005`). Required at request time;
   * if not provided here, the singleton must have it.
   */
  reverseProxyUrl?: string | null
  /** Custom TMDB upstream base URL configured by the user. */
  upstreamBaseURL?: string
  /** TMDB API key configured by the user. Attached as `Authorization: Bearer <apiKey>`. */
  apiKey?: string
  signal?: AbortSignal
}

function buildHeaders(upstream: TmdbUpstream): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-SMM-Proxy-Upstream-BaseURL': upstream.upstreamBaseURL,
  }
  if (upstream.apiKey) {
    headers['Authorization'] = `Bearer ${upstream.apiKey}`
  }
  return headers
}

function buildProxyUrl(upstream: TmdbUpstream, path: string, queryString: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const suffix = queryString ? `?${queryString}` : ''
  return `${upstream.reverseProxyUrl}${normalizedPath}${suffix}`
}

async function fetchJson<T>(url: string, init: RequestInit, errorPrefix: string): Promise<T> {
  const resp = await fetch(url, init)
  if (!resp.ok) {
    throw new Error(`${errorPrefix}: ${resp.status} ${resp.statusText}`)
  }
  return resp.json() as Promise<T>
}

function resolveUpstream(options?: TmdbRequestOptions): TmdbUpstream {
  const reverseProxyUrl = options?.reverseProxyUrl
  if (!reverseProxyUrl) {
    throw new Error(
      'Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.',
    )
  }
  const normalizedUpstream = options?.upstreamBaseURL?.trim() || SMM_TMDB_DEFAULT_UPSTREAM
  const upstreamBaseURL = normalizedUpstream.replace(/\/+$/, '')
  const apiKey = options?.apiKey?.trim() || undefined
  return { reverseProxyUrl, upstreamBaseURL, apiKey }
}

/**
 * Search TMDB for movies or TV shows.
 */
export async function searchTmdb(
  keyword: string,
  type: 'movie' | 'tv',
  language: string,
  options?: TmdbRequestOptions,
): Promise<TmdbSearchResponseBody> {
  const upstream = resolveUpstream(options)
  const queryParams = new URLSearchParams()
  queryParams.append('query', keyword)
  queryParams.append('language', language)
  const url = buildProxyUrl(upstream, `/search/${type}`, queryParams.toString())
  return fetchJson<TmdbSearchResponseBody>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to search TMDB',
  )
}

/**
 * Get TV show by TMDB ID.
 */
export async function getTvShowById(
  id: number,
  language?: string,
  signalOrOptions?: AbortSignal | TmdbRequestOptions,
): Promise<TmdbSeriesDetails> {
  const options =
    signalOrOptions instanceof AbortSignal ? { signal: signalOrOptions } : signalOrOptions
  const upstream = resolveUpstream(options)
  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  const url = buildProxyUrl(upstream, `/tv/${id}`, queryParams.toString())
  return fetchJson<TmdbSeriesDetails>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to get TV show',
  )
}

/**
 * Get movie by TMDB ID.
 */
export async function getMovieById(
  id: number,
  language?: string,
  signalOrOptions?: AbortSignal | TmdbRequestOptions,
): Promise<TmdbMovieDetails> {
  const options =
    signalOrOptions instanceof AbortSignal ? { signal: signalOrOptions } : signalOrOptions
  const upstream = resolveUpstream(options)
  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  const url = buildProxyUrl(upstream, `/movie/${id}`, queryParams.toString())
  return fetchJson<TmdbMovieDetails>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to get movie',
  )
}

/**
 * One entry from TMDB's `/3/configuration/languages` endpoint.
 * @see https://developer.themoviedb.org/reference/configuration-languages
 */
export interface TmdbLanguageEntry {
  iso_639_1: string
  english_name: string
  name: string
}

/**
 * Fetch TMDB's official list of primary translations (IETF tags, e.g. "zh-CN", "en-US").
 * Used to populate the search-language dropdown.
 * @see https://developer.themoviedb.org/reference/configuration-primary-translations
 */
export async function getTmdbPrimaryTranslations(
  options?: TmdbRequestOptions,
): Promise<string[]> {
  const upstream = resolveUpstream(options)
  const url = buildProxyUrl(upstream, `/configuration/primary_translations`, "")
  return fetchJson<string[]>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to fetch TMDB primary translations',
  )
}

/**
 * Fetch TMDB's list of ISO 639-1 languages with English and native names.
 * Used to derive human-readable names for the IETF primary translation tags.
 * @see https://developer.themoviedb.org/reference/configuration-languages
 */
export async function getTmdbLanguages(
  options?: TmdbRequestOptions,
): Promise<TmdbLanguageEntry[]> {
  const upstream = resolveUpstream(options)
  const url = buildProxyUrl(upstream, `/configuration/languages`, "")
  return fetchJson<TmdbLanguageEntry[]>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to fetch TMDB languages',
  )
}

/**
 * Helper function to get TMDB image URL.
 * Handles both relative paths (e.g., /abc123.jpg) and absolute URLs (e.g., https://example.com/image.jpg).
 *
 * Image URLs are served by the TMDB image CDN directly and are NOT routed through the reverse proxy.
 */
export function getTMDBImageUrl(
  path: string | null | undefined = undefined,
  size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500',
): string | null {
  if (!path || typeof path !== 'string') return null

  const trimmedPath = path.trim()
  if (trimmedPath.length === 0) return null

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    return trimmedPath
  }

  const baseUrl = 'https://image.tmdb.org/t/p'
  return `${baseUrl}/${size}${trimmedPath}`
}

/**
 * Get TV season details by series id and season number (TMDB GET /3/tv/{series_id}/season/{season_number}).
 * @see https://developer.themoviedb.org/reference/tv-season-details
 */
export async function getSeason(
  seriesId: number,
  seasonNumber: number,
  language?: string,
  options?: {
    upstreamBaseURL?: string
    apiKey?: string
    reverseProxyUrl?: string | null
    appendToResponse?: string
    signal?: AbortSignal
  },
): Promise<TmdbSeasonDetails> {
  const upstream = resolveUpstream({
    upstreamBaseURL: options?.upstreamBaseURL,
    apiKey: options?.apiKey,
    reverseProxyUrl: options?.reverseProxyUrl,
    signal: options?.signal,
  })
  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  if (options?.appendToResponse) queryParams.append('append_to_response', options.appendToResponse)
  const url = buildProxyUrl(
    upstream,
    `/tv/${seriesId}/season/${seasonNumber}`,
    queryParams.toString(),
  )
  return fetchJson<TmdbSeasonDetails>(
    url,
    {
      method: 'GET',
      headers: buildHeaders(upstream),
      signal: options?.signal,
    },
    'Failed to get TV season',
  )
}
