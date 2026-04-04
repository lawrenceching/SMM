import { basename } from "./path"
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes"
import { getTvdbSearchResultName, tvdbTranslationCodesForMediaLanguage } from "./tvdbSearchDisplay"
import { buildTvdbSearchResults } from "./tvdbSearchNormalize"
import {
    extractMovieId,
    extractSeriesId,
    fetchTvdbAndBuildMovieMediaMetadata,
    fetchTvdbAndBuildTvShowMediaMetadata,
    getTVDBv4Client,
    mapToTvdbLangCode,
} from "./TvdbUtils"

function resolveTvdbSeriesNumericId(item: Record<string, unknown>): number | undefined {
    const oid = item.objectID ?? item.objectId
    const idStr = item.id
    const candidates = [
        typeof oid === "string" ? oid : undefined,
        typeof idStr === "string" ? idStr : undefined,
    ]
    for (const c of candidates) {
        if (!c) continue
        if (c.startsWith("series-")) {
            const n = extractSeriesId(c)
            if (Number.isFinite(n) && n > 0) return n
        }
    }
    const raw = item.tvdb_id ?? item.tvdbId
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw
    if (typeof raw === "string") {
        const n = parseInt(raw.trim(), 10)
        if (Number.isFinite(n) && n > 0) return n
    }
    return undefined
}

function resolveTvdbMovieNumericId(item: Record<string, unknown>): number | undefined {
    const oid = item.objectID ?? item.objectId
    const idStr = item.id
    const candidates = [
        typeof oid === "string" ? oid : undefined,
        typeof idStr === "string" ? idStr : undefined,
    ]
    for (const c of candidates) {
        if (!c) continue
        if (/^movie-/i.test(c)) {
            const n = extractMovieId(c)
            if (Number.isFinite(n) && n > 0) return n
        }
    }
    const raw = item.tvdb_id ?? item.tvdbId
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw
    if (typeof raw === "string") {
        const n = parseInt(raw.trim(), 10)
        if (Number.isFinite(n) && n > 0) return n
    }
    return undefined
}

export async function tryToRecognizeMediaFolderBySearchingFolderNameInTVDB(
    folderPath: string,
    language: "zh-CN" | "en-US" | "ja-JP" = "en-US",
): Promise<RecognizeMediaFolderResult> {
    const folderName = basename(folderPath)
    if (folderName === undefined) {
        console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] folder name is undefined")
        return { success: false }
    }

    const query = folderName.trim()
    if (!query) {
        return { success: false }
    }

    try {
        const tvdb = getTVDBv4Client()
        const tvdbLang = mapToTvdbLangCode(language)
        const codes = tvdbTranslationCodesForMediaLanguage(language)

        const [seriesResp, movieResp] = await Promise.all([
            tvdb.search({ query, type: "series", language: tvdbLang }),
            tvdb.search({ query, type: "movie", language: tvdbLang }),
        ])

        if (seriesResp.status !== "success" || movieResp.status !== "success") {
            console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] TVDB search error:", {
                seriesStatus: seriesResp.status,
                seriesMessage: seriesResp.message,
                movieStatus: movieResp.status,
                movieMessage: movieResp.message,
            })
            return { success: false }
        }

        const seriesItems = buildTvdbSearchResults(seriesResp.data)
        const movieItems = buildTvdbSearchResults(movieResp.data)

        for (const item of seriesItems) {
            const displayName = getTvdbSearchResultName(item, codes, "tv")
            console.log(`[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] series result: ${displayName}`)
            if (folderName === displayName) {
                const id = resolveTvdbSeriesNumericId(item)
                if (id === undefined) {
                    console.warn("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] could not resolve series id", item)
                    continue
                }
                const tvdbTvShow = await fetchTvdbAndBuildTvShowMediaMetadata(id, language, {
                    onSeasonsAPIError: (e) =>
                        console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB]", e),
                    onSeriesAPIError: (e) =>
                        console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB]", e),
                })
                if (tvdbTvShow !== undefined) {
                    return { success: true, type: "tv", tvdbTvShow }
                }
            }
        }

        for (const item of movieItems) {
            const displayName = getTvdbSearchResultName(item, codes, "movie")
            console.log(`[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] movie result: ${displayName}`)
            if (folderName === displayName) {
                const id = resolveTvdbMovieNumericId(item)
                if (id === undefined) {
                    console.warn("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] could not resolve movie id", item)
                    continue
                }
                const tvdbMovie = await fetchTvdbAndBuildMovieMediaMetadata(id, language, {
                    onMovieAPIError: (e) =>
                        console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB]", e),
                })
                if (tvdbMovie !== undefined) {
                    return { success: true, type: "movie", tvdbMovie }
                }
            }
        }

        return { success: false }
    } catch (error) {
        console.error("[tryToRecognizeMediaFolderBySearchingFolderNameInTVDB] Exception:", error)
        return { success: false }
    }
}
