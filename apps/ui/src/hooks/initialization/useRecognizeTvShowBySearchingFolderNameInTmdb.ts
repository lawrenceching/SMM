import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { useTmdbQueries } from "../useTmdbQueries";
import { useGetTmdbTvShowMutation } from "../useGetTmdbTvShowMutation";
import { useMutation } from "@tanstack/react-query";
import type { PreferMediaLanguage, TmdbSearchResponseBody, TvShowMediaMetadata } from "@core/types";
import { basename } from "@/lib/path";

export function useRecognizeTvShowBySearchingFolderNameInTmdb() {
    
    const { search: searchTmdb } = useTmdbQueries()
    const { mutateAsync: getTvShowByIdFromTmdb } = useGetTmdbTvShowMutation()

    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: UIMediaMetadata
            language: PreferMediaLanguage
        }): Promise<TvShowMediaMetadata | undefined> => {
            
            const m = _variables.mediaMetadata;
            const { language } = _variables;
            if(m.type !== "tvshow-folder") {
                console.warn(`[useRecognizeBySearchTvShowFolderNameInTmdb] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const folderName = basename(m.mediaFolderPath!)!
            
            const ret: TmdbSearchResponseBody = await searchTmdb(folderName, "tv", language)
            if(ret.error) {
                console.error(`[useRecognizeBySearchTvShowFolderNameInTmdb] searchTmdb error: ${ret.error}`)
                return undefined;
            }

            if(ret.results.length === 0) {
                console.log(`[useRecognizeBySearchTvShowFolderNameInTmdb] no results found for folder name: ${folderName}`)
                return undefined;
            }

            const tmdbId = ret.results[0].id as number
            return getTvShowByIdFromTmdb({ id: tmdbId, language })
        },
    })
    return mutation;
}