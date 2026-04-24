import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import { basename } from "@/lib/path";
import { useMutation } from "@tanstack/react-query";
import type { MediaMetadata, MovieMediaMetadata, PreferMediaLanguage } from "@core/types";
import { useGetTmdbMovieMutation } from "../useGetTmdbMovieMutation";
import type { TmdbRequestOptions } from "@/api/tmdb";

export function useRecognizeMovieByTmdbIdInFolderNameMutation() {
    
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
                console.warn(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] mediaMetadata is not a movie-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            const tmdbId = getTmdbIdFromFolderName(folderName)
            if(tmdbId === null) {
                console.log(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] tmdbid not found in folder name: ${folderName}`)
                return undefined;
            }

            return await getMovieByIdFromTmdb({ id: parseInt(tmdbId, 10), language, tmdb })
        },
    })

    return mutation;

}