import { basename } from "./path"
import { getTvdbSearchResultName, tvdbTranslationCodesForMediaLanguage } from "./tvdbSearchDisplay"
import { buildTvdbSearchResults } from "./tvdbSearchNormalize"
import {
    extractMovieId,
    extractSeriesId,
    fetchTvdbAndBuildMovieMediaMetadata,
    getTVDBv4Client,
    mapToTvdbLangCode,
} from "./TvdbUtils"
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@core/types"

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

export type TryRecognizeTvShowFolderBySearchingFolderNameInTVDBResult =
    | { success: false }
    | { success: true; tvdbTvShow: TvShowMediaMetadata }

export type TryRecognizeMovieFolderBySearchingFolderNameInTVDBResult =
    | { success: false }
    | { success: true; tvdbMovie: MovieMediaMetadata }

export async function tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB(
    folderPath: string,
    getTvShowByIdFromTvdbFn: (
        seriesId: number,
        language?: PreferMediaLanguage
    ) => Promise<TvShowMediaMetadata>,
    language: PreferMediaLanguage = "en-US",
): Promise<TryRecognizeTvShowFolderBySearchingFolderNameInTVDBResult> {
    const folderName = basename(folderPath)
    if (folderName === undefined) {
        console.error(
            "[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] folder name is undefined",
        )
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

        const seriesResp = await tvdb.search({ query, type: "series", language: tvdbLang })

        if (seriesResp.status !== "success") {
            console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] TVDB search error:", {
                seriesStatus: seriesResp.status,
                seriesMessage: seriesResp.message,
            })
            return { success: false }
        }

        const seriesItems = buildTvdbSearchResults(seriesResp.data)

        for (const item of seriesItems) {
            const displayName = getTvdbSearchResultName(item, codes, "tv")
            console.log(`[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] series result: ${displayName}`)
            const id = resolveTvdbSeriesNumericId(item)
            if (id === undefined) {
                console.warn(
                    "[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] could not resolve series id",
                    item,
                )
                continue
            }
            try {
                console.log(
                    `[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] recognized TV show in TVDB: ${id} ${displayName}`,
                )
                const tvdbTvShow = await getTvShowByIdFromTvdbFn(id, language)
                return { success: true, tvdbTvShow }
            } catch (e) {
                console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB]", e)
            }
        }

        return { success: false }
    } catch (error) {
        console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] Exception:", error)
        return { success: false }
    }
}

export async function tryToRecognizeMovieFolderBySearchingFolderNameInTVDB(
    folderPath: string,
    language: PreferMediaLanguage = "en-US",
): Promise<TryRecognizeMovieFolderBySearchingFolderNameInTVDBResult> {
    const folderName = basename(folderPath)
    if (folderName === undefined) {
        console.error(
            "[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] folder name is undefined",
        )
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

        const movieResp = await tvdb.search({ query, type: "movie", language: tvdbLang })

        if (movieResp.status !== "success") {
            console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] TVDB search error:", {
                movieStatus: movieResp.status,
                movieMessage: movieResp.message,
            })
            return { success: false }
        }

        const movieItems = buildTvdbSearchResults(movieResp.data)

        for (const item of movieItems) {
            const displayName = getTvdbSearchResultName(item, codes, "movie")
            console.log(`[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] movie result: ${displayName}`)
            if (folderName === displayName) {
                const id = resolveTvdbMovieNumericId(item)
                if (id === undefined) {
                    console.warn(
                        "[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] could not resolve movie id",
                        item,
                    )
                    continue
                }
                const tvdbMovie = await fetchTvdbAndBuildMovieMediaMetadata(id, language, {
                    onMovieAPIError: (e) =>
                        console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB]", e),
                })
                if (tvdbMovie !== undefined) {
                    return { success: true, tvdbMovie }
                }
            }
        }

        return { success: false }
    } catch (error) {
        console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] Exception:", error)
        return { success: false }
    }
}
