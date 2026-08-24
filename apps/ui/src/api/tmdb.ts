import type {
  TmdbSearchResponseBody,
  TmdbMovieDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
} from '@core/types'
import localStorages from '@/lib/localStorages'
import { fetchDiscoverConfig, type DiscoverConfig, type ReverseProxyEndpoint } from './discover'
import { isEmpty } from 'es-toolkit/compat'
import { readUserConfig } from './readUserConfig'
import { fetchWithFailover, HttpFailoverExhaustedError } from '@/lib/http'
import staticConfig from './staticConfig'
import { fetchByInternalReverseProxy } from './fetchByInternalReverseProxy'
import { buildTmdbErrorFromResponse } from './tmdbErrors'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { getMovieInTmdb, getTvShowInTmdb, searchInTmdb } from './tmdbV3'

export const SMM_TMDB_DEFAULT_UPSTREAM = 'https://mediadb.vercel.app/api/tmdb'

export type {
  TmdbTvSeasonDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetails,
  TmdbMovieDetails,
} from '@core/types'

/**
 * Optional overrides for a single TMDB request.
 *
 * After the fetchTmdbJson → fetchTmdb migration, the request configuration
 * (reverse proxy URL, upstream base URL, API key, general proxies, fetch
 * implementation) is read internally from `userConfig` and the discover
 * config inside `fetchTmdb`. Only `signal` is consumed from this object.
 */
export interface TmdbRequestOptions {
  signal?: AbortSignal
}



/**
 * Remove domains from the disabled list so they can be retried later.
 * Used when every TMDB host / reverse proxy attempt fails, to avoid
 * permanently banning the whole candidate set.
 */
export function clearDisabledDomains(domains: string[]): void {
  const next = new Set(localStorages.disabledDomains)
  for (const domain of domains) {
    if (!isEmpty(domain)) {
      next.delete(domain)
    }
  }
  localStorages.disabledDomains = next
}

export { fetchByInternalReverseProxy } from './fetchByInternalReverseProxy'

export async function fetchTmdb(urlPath: string, options?: {
  disabledDomains?: Set<string>
  config?: DiscoverConfig
  signal?: AbortSignal,
  defaultUrl?: string,
  defualtProxy?: ReverseProxyEndpoint
}) {

  const userConfig = await readUserConfig()
  const { host, apiKey, httpProxy } = userConfig.tmdb ?? {}

  if (!isEmpty(host) && URL.canParse(host!)) {
    const headers: Record<string, string> = {}
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`
    }
    return await fetchByInternalReverseProxy(
      host!,
      urlPath,
      {
        signal: options?.signal,
        headers,
        httpProxy: httpProxy?.trim(),
      },
    )
  }

  const config = options?.config ?? await fetchDiscoverConfig()
  let hosts = config.mediaDatabases
        .filter(db => db.type === 'tmdb')
        .map(db => db.url)

  if(hosts.length === 0) {
    console.log(`No tmdb hosts found, using default host: ${SMM_TMDB_DEFAULT_UPSTREAM}`)
    hosts = [staticConfig.externalTmdbApiServerBaseUrl]
  }

  return await fetchWithFailover(
    hosts,
    urlPath.startsWith('/') ? urlPath : `/${urlPath}`,
    {
      signal: options?.signal,
      _disabledDomains: options?.disabledDomains,
      _config: config,
    })
}

/**
 * Like {@link fetchTmdb}, but turns exhausted HTTP failover into `undefined`
 * so search callers can map it to {@link TmdbFetchError} via
 * {@link buildTmdbErrorFromResponse}. Scrape/metadata callers should use
 * {@link fetchTmdb} directly so {@link HttpFailoverExhaustedError} propagates.
 */
export async function fetchTmdbOrUndefined(
  urlPath: string,
  options?: Parameters<typeof fetchTmdb>[1],
): Promise<Response | undefined> {
  try {
    return await fetchTmdb(urlPath, options)
  } catch (error) {
    if (error instanceof HttpFailoverExhaustedError) {
      return undefined
    }
    throw error
  }
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
  if (isSmmV3Enabled()) {
    const body = await searchInTmdb(
      { keyword, type, language },
      options?.signal,
    )
    if (body.error) {
      return {
        error: body.error,
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
      }
    }
    if (!body.data) {
      return {
        error: 'Error Reason: empty search result',
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
      }
    }
    return body.data
  }

  const queryParams = new URLSearchParams()
  queryParams.append('query', keyword)
  queryParams.append('language', language)
  const resp = await fetchTmdbOrUndefined(
    `/search/${type}?${queryParams.toString()}`,
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<TmdbSearchResponseBody>
}

/**
 * Get TV show by TMDB ID.
 */
export async function getTvShowById(
  id: number,
  language?: string,
  options?: TmdbRequestOptions,
): Promise<TmdbSeriesDetails> {
  if (isSmmV3Enabled()) {
    const body = await getTvShowInTmdb({ id, language }, options?.signal)
    if (body.error) {
      throw new Error(body.error)
    }
    if (!body.data) {
      throw new Error('Error Reason: empty TV show result')
    }
    return body.data
  }

  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  const resp = await fetchTmdb(
    `/tv/${id}?${queryParams.toString()}`,
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<TmdbSeriesDetails>
}

/**
 * Get movie by TMDB ID.
 */
export async function getMovieById(
  id: number,
  language?: string,
  options?: TmdbRequestOptions,
): Promise<TmdbMovieDetails> {
  if (isSmmV3Enabled()) {
    const body = await getMovieInTmdb({ id, language }, options?.signal)
    if (body.error) {
      throw new Error(body.error)
    }
    if (!body.data) {
      throw new Error('Error Reason: empty movie result')
    }
    return body.data
  }

  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  const resp = await fetchTmdb(
    `/movie/${id}?${queryParams.toString()}`,
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<TmdbMovieDetails>
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
  const resp = await fetchTmdb(
    '/configuration/primary_translations',
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<string[]>
}

/**
 * Fetch TMDB's list of ISO 639-1 languages with English and native names.
 * Used to derive human-readable names for the IETF primary translation tags.
 * @see https://developer.themoviedb.org/reference/configuration-languages
 */
export async function getTmdbLanguages(
  options?: TmdbRequestOptions,
): Promise<TmdbLanguageEntry[]> {
  const resp = await fetchTmdb(
    '/configuration/languages',
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<TmdbLanguageEntry[]>
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
  options?: TmdbRequestOptions,
): Promise<TmdbSeasonDetails> {
  const queryParams = new URLSearchParams()
  if (language) queryParams.append('language', language)
  const resp = await fetchTmdb(
    `/tv/${seriesId}/season/${seasonNumber}?${queryParams.toString()}`,
    { signal: options?.signal },
  )
  if (!resp || !resp.ok) {
    throw await buildTmdbErrorFromResponse(resp)
  }
  return resp.json() as Promise<TmdbSeasonDetails>
}

export { TmdbFetchError, classifyTmdbError, formatTmdbErrorForDisplay, buildTmdbErrorFromResponse } from './tmdbErrors'

