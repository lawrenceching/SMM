import type { MediaMetadata } from "@core/types";
import { Path } from "@core/path";
import { readFile } from "@/api/readFile";
import { parseTvShowNfo } from "@/lib/nfo";
import { useMutation } from "@tanstack/react-query";
import type { PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { useGetTmdbTvShowMutation } from "@/hooks/useGetTmdbTvShowMutation";
import { useGetTvdbTvShowMutation } from "@/hooks/useGetTvdbTvShowMutation";


export function useRecognizeTvShowByNfoMutation() {

    const { mutateAsync: getTvShowByIdFromTmdb } = useGetTmdbTvShowMutation()
    const { mutateAsync: getTvShowByIdFromTvdb } = useGetTvdbTvShowMutation()
 
    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: MediaMetadata
            language: PreferMediaLanguage
        }): Promise<TvShowMediaMetadata | undefined> => {

            const m = _variables.mediaMetadata;
            const { language } = _variables;
            
            if(m.type !== "tvshow-folder") {
                console.warn(`[useRecognizeTvShowByNfoMutation] mediaMetadata is not a tvshow-folder: ${m.type}`)
            }

            const tvShowNfoFilePathInPosix = m.files?.find(file => file.endsWith('/tvshow.nfo'))
            if(tvShowNfoFilePathInPosix === undefined) {
                console.warn(`[useRecognizeTvShowByNfoMutation] tvshow.nfo not found`)
                return undefined
            }

            const tvShowNfoFilePath = Path.toPlatformPath(tvShowNfoFilePathInPosix)
            const resp = await readFile(tvShowNfoFilePath)

            if(resp.error) {
                console.error(`[useRecognizeTvShowByNfoMutation] unable to read tvshow.nfo file: ${tvShowNfoFilePath}`, resp.error)
                return undefined
            }

            if(resp.data === undefined) {
                console.error(`[useRecognizeTvShowByNfoMutation] unexpected response body: no data`, resp)
                return undefined
            }

            const tvShowNfo = await parseTvShowNfo(resp.data)

            const tmdbId = tvShowNfo?.tmdbid
            if(tmdbId !== undefined) {
                console.log(`found tmdbid in tvshow.nfo: ${tmdbId}`)
                return await getTvShowByIdFromTmdb({ id: parseInt(tmdbId, 10), language })
            }

            const tvdbId = tvShowNfo?.tvdbid
            if(tvdbId !== undefined) {
                console.log(`found tvdbid in tvshow.nfo: ${tvdbId}`)
                return await getTvShowByIdFromTvdb({ seriesId: parseInt(tvdbId, 10), language })
            }

            console.warn(`[useRecognizeTvShowByNfoMutation] no tmdbid or tvdbid found in tvshow.nfo`)
            return undefined
        },
    })

    return mutation;
}