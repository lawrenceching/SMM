import { useMutation } from "@tanstack/react-query";
import type { MediaMetadata, MovieMediaMetadata, PreferMediaLanguage } from "@core/types";
import { basename } from "@/lib/path";
import { useTvdbQueries } from "../useTvdbQueries";
import type { TVDBv4SearchResult } from "@smm/tvdb4";
import { useGetTvdbMovieMutation } from "../useGetTvdbMovieMutation";
import { extractMovieId } from "@/lib/TvdbUtils";

function resolveTvdbMovieId(result: TVDBv4SearchResult): number | undefined {
    const record = result as Record<string, unknown>
    const candidates: unknown[] = [record.id, record.objectID, record.objectId, record.tvdb_id, record.tvdbId]
    for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
            return candidate
        }
        if (typeof candidate === "string") {
            const trimmed = candidate.trim()
            if (!trimmed) continue
            if (/^movie-/i.test(trimmed)) {
                const n = extractMovieId(trimmed)
                if (Number.isFinite(n) && n > 0) return n
                continue
            }
            const n = parseInt(trimmed, 10)
            if (Number.isFinite(n) && n > 0) {
                return n
            }
        }
    }
    return undefined
}

export function useRecognizeMovieBySearchingFolderNameInTvdb() {
    
    const { search: searchTvdb } = useTvdbQueries()
    const { mutateAsync: getMovieByIdFromTvdb } = useGetTvdbMovieMutation()

    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: MediaMetadata
            language: PreferMediaLanguage
        }): Promise<MovieMediaMetadata | undefined> => {
            
            const m = _variables.mediaMetadata;
            const { language } = _variables;
            if(m.type !== "movie-folder") {
                console.warn(`[useRecognizeBySearchTvShowFolderNameInTmdb] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            
            const ret: TVDBv4SearchResult[] | undefined = await searchTvdb({ query: folderName, type: "movie", language })
            if(ret === undefined || ret.length === 0) {
                console.log(`[useRecognizeBySearchTvShowFolderNameInTvdb] no results found for folder name: ${folderName}`)
                return undefined;
            }

            const firstResult = ret[0]
            const movieId = resolveTvdbMovieId(firstResult)
            if (movieId === undefined) {
                console.warn(
                    "[useRecognizeMovieBySearchingFolderNameInTvdb] Unable to resolve numeric TVDB movie id from first search result",
                    {
                        folderName,
                        firstResult,
                    }
                )
                return undefined
            }
            return getMovieByIdFromTvdb({ movieId, language })
        },
    })
    return mutation;
}