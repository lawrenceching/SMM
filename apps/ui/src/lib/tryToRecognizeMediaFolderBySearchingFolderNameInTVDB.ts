import type { TVDBv4SearchParams, TVDBv4SearchResult } from "@smm/tvdb4"
import { basename } from "./path"
import { getTvdbSearchResultName, tvdbTranslationCodesForMediaLanguage } from "./tvdbSearchDisplay"
import { buildTvdbSearchResults } from "./tvdbSearchNormalize"
import {
    extractMovieId,
    extractSeriesId,
    fetchTvdbAndBuildMovieMediaMetadata,
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
    searchInTvdbFn: (params: TVDBv4SearchParams) => Promise<TVDBv4SearchResult[] | undefined>,
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
        const tvdbLang = mapToTvdbLangCode(language)
        const codes = tvdbTranslationCodesForMediaLanguage(language)

        const seriesRaw = await searchInTvdbFn({ query, type: "series", language: tvdbLang })

        if (!seriesRaw?.length) {
            console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTVDB] TVDB search returned no results", {
                hadResponse: seriesRaw !== undefined,
            })
            return { success: false }
        }

        const seriesItems = buildTvdbSearchResults(seriesRaw)

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
    searchInTvdbFn: (params: TVDBv4SearchParams) => Promise<TVDBv4SearchResult[] | undefined>,
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
        const tvdbLang = mapToTvdbLangCode(language)
        const codes = tvdbTranslationCodesForMediaLanguage(language)

        const movieRaw = await searchInTvdbFn({ query, type: "movie", language: tvdbLang })

        if (!movieRaw?.length) {
            console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTVDB] TVDB search returned no results", {
                hadResponse: movieRaw !== undefined,
            })
            return { success: false }
        }

        const movieItems = buildTvdbSearchResults(movieRaw)

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
