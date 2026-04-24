import { useMutation } from "@tanstack/react-query";
import type { MediaMetadata, MovieMediaMetadata, PreferMediaLanguage } from "@core/types";
import { basename } from "@/lib/path";
import { useTmdbQueries } from "../useTmdbQueries";
import { useGetTmdbMovieMutation } from "../useGetTmdbMovieMutation";
import type { TmdbRequestOptions } from "@/api/tmdb";

export function useRecognizeMovieBySearchingFolderNameInTmdb() {
    
    const { search: searchTmdb } = useTmdbQueries()
    const { mutateAsync: getMovieByIdFromTmdb } = useGetTmdbMovieMutation()

    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: MediaMetadata
            language: PreferMediaLanguage
            tmdb?: TmdbRequestOptions
        }): Promise<MovieMediaMetadata | undefined> => {
            
            const m = _variables.mediaMetadata;
            const { language, tmdb } = _variables;
            if(m.type !== "movie-folder") {
                console.warn(`[useRecognizeBySearchTvShowFolderNameInTmdb] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            
            const ret = await searchTmdb(folderName, "movie", language, tmdb)

            if(ret.error) {
                console.error(`[useRecognizeBySearchTvShowFolderNameInTmdb] searchTmdb error: ${ret.error}`)
                return undefined;
            }

            if(ret.results.length === 0) {
                console.log(`[useRecognizeBySearchTvShowFolderNameInTmdb] no results found for folder name: ${folderName}`)
                return undefined;
            }

            const tmdbId = ret.results[0].id as number
            return getMovieByIdFromTmdb({ id: tmdbId, language, tmdb })
        },
    })
    return mutation;
}
