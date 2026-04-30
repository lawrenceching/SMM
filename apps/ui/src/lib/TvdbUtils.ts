import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types"
import { TVDBv4 } from "@smm/tvdb4"
import type { TVDBv4Season } from "@smm/tvdb4/types"
import Debug from "debug"
export const SMM_TVDB_DEFAULT_UPSTREAM = 'https://tmdb-mcp-server.imlc.me/api/tvdb'

export interface TvdbUpstream {
    reverseProxyUrl: string
    upstreamBaseURL: string
    apiKey?: string
    requiresAuth: boolean
}

const debug = Debug('TvdbUtils')

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

export async function fetchTvdbAndBuildTvShowMediaMetadata(
    seriesId: number,
    lang: "zh-CN" | "en-US" | "ja-JP",
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

    const tvdbLangCode = mapToTvdbLangCode(lang);
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

        for(const season of seasons) {

            const seasonId = season.id;
            
            const seasonResp = await tvdb.seasonExtendedById(seasonId)
            
            if(seasonResp.status === 'success') {
                for (const episode of seasonResp.data.episodes) {
                    const mediaSeason = m.seasons.find((s) => s.season === episode.seasonNumber);
                    // season (TVDB `season` in outer loop) nameTranslations: could use
                    // GET /seasons/{id}/translations/{lang} to populate mediaSeason.name when needed.

                    let episodeName = episode.name;
                    if (episode.nameTranslations?.includes(tvdbLangCode)) {
                        try {
                            const tr = await tvdb.episodeTranslationByLangCode(episode.id, tvdbLangCode);
                            if (tr.status === 'success') {
                                const translated = tr.data['name'];
                                if (typeof translated === 'string' && translated.trim()) {
                                    episodeName = translated;
                                }
                            } else {
                                console.warn(`Failed to get TVDB episode ${episode.id} translation (${tvdbLangCode}): ${tr.message ?? 'N/A'}`)
                            }
                        } catch (e) {
                            console.warn(
                                `TVDB episode ${episode.id} translation (${tvdbLangCode}) failed; using default title`,
                                e,
                            );
                        }
                    }

                    if (mediaSeason) {
                        mediaSeason.episodes.push({
                            season: episode.seasonNumber,
                            episode: episode.number,
                            name: episodeName,
                        });
                    } else {
                        console.warn(`Failed to find season ${episode.seasonNumber} in TVDB series ${seriesId}`)
                        m.seasons.push({
                            season: episode.seasonNumber,
                            name: 'N/A',
                            episodes: [{
                                season: episode.seasonNumber,
                                episode: episode.number,
                                name: episodeName,
                            }],
                        })
                    }
                }
            } else {
                console.warn(`Failed to get TVDB season ${seasonId}: ${seasonResp.message ?? 'N/A'}`)
                callbacks.onSeasonsAPIError?.(new Error(`Failed to get TVDB season ${seasonId}: ${seasonResp.message ?? 'N/A'}`))
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
    lang: "zh-CN" | "en-US" | "ja-JP",
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
    const tvdbLangCode = mapToTvdbLangCode(lang)

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
