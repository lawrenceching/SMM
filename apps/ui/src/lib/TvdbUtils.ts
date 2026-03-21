import type { TvShowMediaMetadata } from "@core/types"
import { TVDBv4 } from "@smm/tvdb4"
import type { TVDBv4Season } from "@smm/tvdb4/types"

/**
 * The TVDB search API return object id in form "series-421069".
 * This function return the number id extracted from the object id.
 */
export function extractSeriesId(objectId: string): number {
    const str = objectId.replace('series-', '').trim()
    return parseInt(str, 10)
}

export function getTVDBv4Client() {
    return new TVDBv4({
        baseUrl: `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/tvdb`,
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
    }
    
    const seriesResp = await tvdb.seriesExtendedById(seriesId)
    if(seriesResp.status === 'success') {
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
                seasonResp.data.episodes.forEach((episode) => {

                    const season = m.seasons.find((s) => s.season === episode.seasonNumber);

                    
                    // season.nameTranslations indicates what translation provided
                    // TODO need to call /seasons/{id}/translations/{lang} to get the translated text
                    season?.name

                    if(season) {
                        
                        // episode.nameTranslations indicates what translation provided
                        // TODO need to call /episodes/{id}/translations/{lang} to get the translated text

                        season.episodes.push({
                            season: episode.seasonNumber,
                            episode: episode.number,
                            name: episode.name,
                        })
                    } else {
                        debugger;
                        console.warn(`Failed to find season ${episode.seasonNumber} in TVDB series ${seriesId}`)
                        m.seasons.push({
                            season: episode.seasonNumber,
                            name: 'N/A',
                            episodes: [{
                                season: episode.seasonNumber,
                                episode: episode.number,
                                name: episode.name,
                            }],
                        })
                    }

                })
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