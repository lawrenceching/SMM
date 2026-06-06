import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types"
import { TVDBv4 } from "@smm/tvdb4"
import type { TVDBv4LanguageRecord, TVDBv4Season } from "@smm/tvdb4/types"
import Debug from "debug"
export const SMM_TVDB_DEFAULT_UPSTREAM = 'https://tmdb-mcp-server.imlc.me/api/tvdb'

export interface TvdbUpstream {
    reverseProxyUrl: string
    upstreamBaseURL: string
    apiKey?: string
    requiresAuth: boolean
}

const debug = Debug('TvdbUtils')

function isParallelTranslationEnabled(): boolean {
  try {
    return localStorage.getItem("feature.parallelTvdbTranslationRequest") !== "false"
  } catch {
    return true
  }
}

/**
 * The TVDB search API return object id in form "series-421069".
 * This function return the number id extracted from the object id.
 */
export function extractSeriesId(objectId: string): number {
    const str = objectId.replace('series-', '').trim()
    return parseInt(str, 10)
}

/**
 * TVDB search returns movie `objectID` / `id` like "movie-15778".
 */
export function extractMovieId(objectId: string): number {
    const str = objectId.replace(/^movie-/i, '').trim()
    const n = parseInt(str, 10)
    return Number.isFinite(n) && n > 0 ? n : NaN
}

export interface GetTVDBv4ClientOverrides {
    reverseProxyUrl?: string | null
    upstreamBaseURL?: string
    apiKey?: string
}

function resolveTvdbUpstream(overrides?: GetTVDBv4ClientOverrides): TvdbUpstream {
    const reverseProxyUrl = overrides?.reverseProxyUrl
    if (!reverseProxyUrl) {
        throw new Error(
            'Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.',
        )
    }
    const upstreamBaseURL =
        overrides?.upstreamBaseURL?.trim() || SMM_TVDB_DEFAULT_UPSTREAM
    const apiKey = overrides?.apiKey?.trim() || undefined
    return {
        reverseProxyUrl,
        upstreamBaseURL,
        apiKey,
        requiresAuth: upstreamBaseURL !== SMM_TVDB_DEFAULT_UPSTREAM,
    }
}

/**
 * Memoization cache keyed by `(reverseProxyUrl, upstreamBaseURL, apiKey)` so
 * the in-process token cache inside `TVDBv4` (its `this.token` /
 * `this.tokenExpiresAt`) survives across calls during a single UI session.
 */
const tvdbClientCache = new Map<string, TVDBv4>()

function buildClientCacheKey(upstream: TvdbUpstream): string {
    return [upstream.reverseProxyUrl, upstream.upstreamBaseURL, upstream.apiKey ?? ""].join("|")
}

function buildTvdbClient(upstream: TvdbUpstream): TVDBv4 {
    return new TVDBv4({
        baseUrl: upstream.reverseProxyUrl,
        apiKey: upstream.apiKey ?? "",
        // Login is required only when the upstream is a real TVDB v4 host. The SMM-managed
        // default upstream does not require a login request.
        disableAuth: !(upstream.requiresAuth && Boolean(upstream.apiKey)),
        fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers)
            headers.set('X-SMM-Proxy-Upstream-BaseURL', upstream.upstreamBaseURL)
            return window.fetch(input, { ...init, headers })
        },
    })
}

/**
 * Build (or reuse) a `TVDBv4` client that always routes traffic through the
 * discovered reverse proxy. Callers should pass `(reverseProxyUrl,
 * upstreamBaseURL, apiKey)` from UI configuration/hooks.
 *
 * Throws when no reverse proxy URL is available (no fallback to a CLI
 * `/tvdb/*` route).
 */
export function getTVDBv4Client(overrides?: GetTVDBv4ClientOverrides): TVDBv4 {
    const upstream = resolveTvdbUpstream(overrides)
    const key = buildClientCacheKey(upstream)
    const cached = tvdbClientCache.get(key)
    if (cached) return cached
    const client = buildTvdbClient(upstream)
    tvdbClientCache.set(key, client)
    return client
}

/**
 * Test-only helper to clear the memoization cache between test cases.
 */
export function _resetTvdbClientCacheForTesting(): void {
    tvdbClientCache.clear()
}

/**
 * Fetch TVDB's list of supported languages (ISO 639-3 codes).
 * @see https://thetvdb.github.io/v4-api/#/Languages/getAllLanguages
 */
export async function getTvdbLanguages(
    overrides?: GetTVDBv4ClientOverrides,
): Promise<TVDBv4LanguageRecord[] | undefined> {
    const tvdb = getTVDBv4Client(overrides)
    const resp = await tvdb.languages()
    return resp.status === "success" ? resp.data : undefined
}

export async function fetchTvdbAndBuildTvShowMediaMetadata(
    seriesId: number,
    lang: string,
    callbacks: {
        onSeasonsAPIError?: (error: Error) => void,
        onSeriesAPIError?: (error: Error) => void,
    },
    overrides?: GetTVDBv4ClientOverrides,
): Promise<TvShowMediaMetadata | undefined> {

    debug(`fetchTvdbAndBuildTvShowMediaMetadata CALLED: seriesId: ${seriesId}, lang: ${lang}`)

    const m: TvShowMediaMetadata = {
        id: seriesId.toString(),
        name: '',
        database: "TVDB",
        seasons: [],
    }

    const tvdb = getTVDBv4Client(overrides);

    // The search language is now an ISO 639-3 code (e.g. "eng", "zho").
    // When callers still pass the legacy 3-value union (`zh-CN`/`en-US`/`ja-JP`),
    // `mapToTvdbLangCode` performs the conversion.
    const tvdbLangCode = isPreferMediaLanguage(lang) ? mapToTvdbLangCode(lang) : lang;
    const translationResp = await tvdb.seriesTranslationByLangCode(seriesId, tvdbLangCode)
    if(translationResp.status === 'success') {
        const translatedName = translationResp.data['name'] || ''
        console.log(`fetched translated name in ${tvdbLangCode}: ${translatedName}`)
        m.name = translatedName || ''
    } else {
        console.warn(`Failed to get TVDB series ${seriesId} translation (${tvdbLangCode}): ${translationResp.message ?? 'N/A'}`)
    }
    
    const seriesResp = await tvdb.seriesExtendedById(seriesId)
    if(seriesResp.status === 'success') {

        m.airDate = seriesResp.data.firstAired
        
        const seasons = seriesResp.data.seasons
        .filter((season: TVDBv4Season) => season.type.name === 'Aired Order')


        for(const season of seasons) {
            m.seasons.push({
                season: season.number,
                name: '',
                episodes: [],
            })
        }

        // Collect episode data across all seasons
        interface EpisodeData {
          episodeId: number
          seasonNumber: number
          episodeNumber: number
          defaultName: string
          needsTranslation: boolean
        }
        const allEpisodes: EpisodeData[] = []

        for (const season of seasons) {
          const seasonId = season.id
          const seasonResp = await tvdb.seasonExtendedById(seasonId)

          if (seasonResp.status === 'success') {
            for (const episode of seasonResp.data.episodes) {
              allEpisodes.push({
                episodeId: episode.id,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.number,
                defaultName: episode.name,
                needsTranslation:
                  episode.nameTranslations?.includes(tvdbLangCode) ?? false,
              })
            }
          } else {
            console.warn(`Failed to get TVDB season ${seasonId}: ${seasonResp.message ?? 'N/A'}`)
            callbacks.onSeasonsAPIError?.(new Error(`Failed to get TVDB season ${seasonId}: ${seasonResp.message ?? 'N/A'}`))
          }
        }

        // Resolve episode translations
        const translationResults = new Map<number, string>()
        const episodesToTranslate = allEpisodes.filter((e) => e.needsTranslation)

        if (episodesToTranslate.length > 0) {
          if (isParallelTranslationEnabled()) {
            const promises = episodesToTranslate.map((e) =>
              tvdb
                .episodeTranslationByLangCode(e.episodeId, tvdbLangCode)
                .then((tr) =>
                  tr.status === 'success'
                    ? (tr.data as Record<string, string> | undefined)?.['name']
                    : undefined,
                )
                .catch(() => undefined),
            )
            const results = await Promise.allSettled(promises)
            results.forEach((result, idx) => {
              const ep = episodesToTranslate[idx]
              if (result.status === 'fulfilled' && typeof result.value === 'string' && result.value.trim()) {
                translationResults.set(ep.episodeId, result.value.trim())
              }
            })
          } else {
            for (const ep of episodesToTranslate) {
              try {
                const tr = await tvdb.episodeTranslationByLangCode(ep.episodeId, tvdbLangCode)
                if (tr.status === 'success') {
                  const translated = tr.data['name']
                  if (typeof translated === 'string' && translated.trim()) {
                    translationResults.set(ep.episodeId, translated.trim())
                  }
                } else {
                  console.warn(
                    `Failed to get TVDB episode ${ep.episodeId} translation (${tvdbLangCode}): ${tr.message ?? 'N/A'}`,
                  )
                }
              } catch (e) {
                console.warn(
                  `TVDB episode ${ep.episodeId} translation (${tvdbLangCode}) failed; using default title`,
                  e,
                )
              }
            }
          }
        }

        // Push episodes into seasons
        for (const ep of allEpisodes) {
          const episodeName = translationResults.get(ep.episodeId) || ep.defaultName
          const mediaSeason = m.seasons.find((s) => s.season === ep.seasonNumber)
          if (mediaSeason) {
            mediaSeason.episodes.push({
              season: ep.seasonNumber,
              episode: ep.episodeNumber,
              name: episodeName,
            })
          } else {
            console.warn(`Failed to find season ${ep.seasonNumber} in TVDB series ${seriesId}`)
            m.seasons.push({
              season: ep.seasonNumber,
              name: 'N/A',
              episodes: [
                {
                  season: ep.seasonNumber,
                  episode: ep.episodeNumber,
                  name: episodeName,
                },
              ],
            })
          }
        }

    } else {
        const msg = `Failed to get TVDB series ${seriesId}: ${seriesResp.message ?? 'N/A'}`
        console.error(msg)
        callbacks.onSeriesAPIError?.(new Error(msg))
        return;
    }

    console.log(`built TvShowMediaMetadata`, m)

    return m;
}

export async function fetchTvdbAndBuildMovieMediaMetadata(
    movieId: number,
    lang: string,
    callbacks: {
        onMovieAPIError?: (error: Error) => void,
    },
    overrides?: GetTVDBv4ClientOverrides,
): Promise<MovieMediaMetadata | undefined> {

    const m: MovieMediaMetadata = {
        id: movieId.toString(),
        name: '',
        database: "TVDB",
    }

    const tvdb = getTVDBv4Client(overrides)
    // The search language is now an ISO 639-3 code (e.g. "eng", "zho").
    // When callers still pass the legacy 3-value union (`zh-CN`/`en-US`/`ja-JP`),
    // `mapToTvdbLangCode` performs the conversion.
    const tvdbLangCode = isPreferMediaLanguage(lang) ? mapToTvdbLangCode(lang) : lang;

    const translationResp = await tvdb.movieTranslationByLangCode(movieId, tvdbLangCode)
    if (translationResp.status === 'success') {
        const translatedName = translationResp.data['name'] || ''
        console.log(`fetched movie translated name in ${tvdbLangCode}: ${translatedName}`)
        m.name = translatedName || ''
    }

    const movieResp = await tvdb.movieExtendedById(movieId)
    if (movieResp.status !== 'success') {
        const msg = `Failed to get TVDB movie ${movieId}: ${movieResp.message ?? 'N/A'}`
        console.error(msg)
        callbacks.onMovieAPIError?.(new Error(msg))
        return undefined
    }

    const data = movieResp.data as Record<string, unknown>
    const defaultName = typeof data.name === 'string' ? data.name : ''
    if (!m.name.trim()) {
        m.name = defaultName
    }
    const firstRelease = data.first_release as Record<string, unknown> | undefined
    const airDateCandidates: Array<unknown> = [
        firstRelease?.first,
        data.release_date,
        data.firstAired,
        data.first_air_time,
        data.year,
    ]
    for (const candidate of airDateCandidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
            m.airDate = candidate
            break
        }
    }

    console.log('built MovieMediaMetadata', m)
    return m
}

/**
 * Map IETF BCP 47 / RFC 5646 lang code to ISO 639 lang code(which is used by TVDB)
 * For example, zh-CN -> zho
 */
export function mapToTvdbLangCode(lang: "zh-CN" | "en-US" | "ja-JP"): string {
    switch(lang) {
        case "zh-CN":
            return "zho"
        case "en-US":
            return "eng"
        case "ja-JP":
            return "jpn"
        default:
            console.warn(`[mapToTvdbLangCode] Unknown language: ${lang}, use default eng`)
            return "eng"
    }
}

/**
 * Type guard: is the language code one of the 3 legacy IETF tags?
 * Used by TVDB utilities to decide whether to apply the IETF→ISO 639-3 mapping
 * (legacy `userConfig.preferMediaLanguage` callers) or pass the value
 * through unchanged (new search-time ISO 639-3 callers).
 */
function isPreferMediaLanguage(lang: string): lang is "zh-CN" | "en-US" | "ja-JP" {
    return lang === "zh-CN" || lang === "en-US" || lang === "ja-JP"
}
