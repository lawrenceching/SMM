import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { useGetTmdbTvShowMutation } from "../useGetTmdbTvShowMutation";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import { basename } from "@/lib/path";
import { useMutation } from "@tanstack/react-query";
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";

export function useRecognizeTvShowByTmdbIdInFolderNameMutation() {

    const { mutateAsync: getTvShowByIdFromTmdb } = useGetTmdbTvShowMutation()
    
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
            const tmdbId = getTmdbIdFromFolderName(folderName)
            if(tmdbId === null) {
                console.log(`[useRecognizeByTmdbIdInTvShowFolderNameMutation] tmdbid not found in folder name: ${folderName}`)
                return undefined;
            }

            return await getTvShowByIdFromTmdb({ id: parseInt(tmdbId, 10), language })
        },
    })

    return mutation;

}