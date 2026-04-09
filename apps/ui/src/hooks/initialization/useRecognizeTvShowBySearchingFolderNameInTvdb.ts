import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { useMutation } from "@tanstack/react-query";
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { basename } from "@/lib/path";
import { useGetTvdbTvShowMutation } from "../useGetTvdbTvShowMutation";
import { useTvdbQueries } from "../useTvdbQueries";
import type { TVDBv4SearchResult } from "@smm/tvdb4";

export function useRecognizeTvShowBySearchingFolderNameInTvdb() {
    
    const { search: searchTvdb } = useTvdbQueries()
    const { mutateAsync: getTvShowByIdFromTvdb } = useGetTvdbTvShowMutation()

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
            
            const ret: TVDBv4SearchResult[] | undefined = await searchTvdb({ query: folderName, type: "series", language })
            if(ret === undefined || ret.length === 0) {
                console.log(`[useRecognizeBySearchTvShowFolderNameInTvdb] no results found for folder name: ${folderName}`)
                return undefined;
            }

            const tvdbId = ret[0].id
            return getTvShowByIdFromTvdb({ seriesId: parseInt(tvdbId, 10), language })
        },
    })
    return mutation;
}