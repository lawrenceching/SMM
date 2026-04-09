import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { basename } from "@/lib/path";
import { useMutation } from "@tanstack/react-query";
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { useGetTvdbTvShowMutation } from "../useGetTvdbTvShowMutation";
import { getTvdbIdFromFolderName } from "@/lib/recognizeMediaFolderByTvdbIdInFolderName";

export function useRecognizeTvShowByTvdbIdInFolderNameMutation() {

    const { mutateAsync: getTvShowByIdFromTvdb } = useGetTvdbTvShowMutation()
    
    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: UIMediaMetadata
            language: PreferMediaLanguage
        }): Promise<TvShowMediaMetadata | undefined> => {
            const m = _variables.mediaMetadata;
            const { language } = _variables;
            if(m.type !== "tvshow-folder") {
                console.warn(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            const tmdbId = getTvdbIdFromFolderName(folderName)
            if(tmdbId === null) {
                console.log(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] tmdbid not found in folder name: ${folderName}`)
                return undefined;
            }

            return await getTvShowByIdFromTvdb({ seriesId: parseInt(tmdbId, 10), language })
        },
    })

    return mutation;

}