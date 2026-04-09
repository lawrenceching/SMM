import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types"
import { TVDBv4 } from "@smm/tvdb4"
import type { TVDBv4Season } from "@smm/tvdb4/types"
import Debug from "debug"

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

export function getTVDBv4Client() {
    return new TVDBv4({
        baseUrl: `${window.location.protocol}//${window.location.hostname}:${window.location.port}/tvdb`,
        // `fetch` 作为裸函数被传递后，在某些运行环境里会丢失 `this` 绑定，
        // 导致 `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`。
        // 绑定到 `window` 后可避免该问题。
        fetchImpl: window.fetch.bind(window),
      })
}

export async function fetchTvdbAndBuildTvShowMediaMetadata(
    seriesId: number,
    lang: "zh-CN" | "en-US" | "ja-JP",
    callbacks: {
        onSeasonsAPIError?: (error: Error) => void,
        onSeriesAPIError?: (error: Error) => void,
    }
): Promise<TvShowMediaMetadata | undefined> {

    debug(`fetchTvdbAndBuildTvShowMediaMetadata CALLED: seriesId: ${seriesId}, lang: ${lang}`)

    const m: TvShowMediaMetadata = {
        id: seriesId.toString(),
        name: '',
        database: "TVDB",
        seasons: [],
    }

    const tvdb = getTVDBv4Client();

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
                        debugger;
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
    }
): Promise<MovieMediaMetadata | undefined> {

    const m: MovieMediaMetadata = {
        id: movieId.toString(),
        name: '',
        database: "TVDB",
    }

    const tvdb = getTVDBv4Client()
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