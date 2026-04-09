import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { basename } from "@/lib/path";
import { useMutation } from "@tanstack/react-query";
import type { MovieMediaMetadata, PreferMediaLanguage } from "@core/types";
import { getTvdbIdFromFolderName } from "@/lib/recognizeMediaFolderByTvdbIdInFolderName";
import { useGetTvdbMovieMutation } from "../useGetTvdbMovieMutation";

export function useRecognizeMovieByTvdbIdInFolderNameMutation() {

    const { mutateAsync: getMovieByIdFromTvdb } = useGetTvdbMovieMutation()
    
    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: UIMediaMetadata
            language: PreferMediaLanguage
        }): Promise<MovieMediaMetadata | undefined> => {
            const m = _variables.mediaMetadata;
            const { language } = _variables;
            if(m.type !== "movie-folder") {
                console.warn(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            const tmdbId = getTvdbIdFromFolderName(folderName)
            if(tmdbId === null) {
                console.log(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] tmdbid not found in folder name: ${folderName}`)
                return undefined;
            }

            return await getMovieByIdFromTvdb({ movieId: parseInt(tmdbId, 10), language })
        },
    })

    return mutation;

}