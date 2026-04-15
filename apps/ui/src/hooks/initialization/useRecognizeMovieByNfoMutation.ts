import { Path } from "@core/path";
import { readFile } from "@/api/readFile";
import { parseMovieNfo } from "@/lib/nfo";
import { useMutation } from "@tanstack/react-query";
import type { MediaMetadata, MovieMediaMetadata, PreferMediaLanguage } from "@core/types";
import { useGetTmdbMovieMutation } from "@/hooks/useGetTmdbMovieMutation";
import { useGetTvdbMovieMutation } from "@/hooks/useGetTvdbMovieMutation";

export function useRecognizeMovieByNfoMutation() {
    const { mutateAsync: getMovieByIdFromTmdb } = useGetTmdbMovieMutation()
    const { mutateAsync: getMovieByIdFromTvdb } = useGetTvdbMovieMutation()

    const mutation = useMutation({
        mutationFn: async (_variables: {
            mediaMetadata: MediaMetadata
            language: PreferMediaLanguage
        }): Promise<MovieMediaMetadata | undefined> => {
            const m = _variables.mediaMetadata;
            const { language } = _variables;
            
            if(m.type !== "movie-folder") {
                console.warn(`[useRecognizeMovieByNfoMutation] mediaMetadata is not a movie-folder: ${m.type}`)
            }

            const movieNfoFilePathInPosix = m.files?.find(file => file.endsWith('/movie.nfo'))
            if(movieNfoFilePathInPosix === undefined) {
                console.warn(`[useRecognizeMovieByNfoMutation] movie.nfo not found`)
                return undefined
            }

            const movieNfoFilePath = Path.toPlatformPath(movieNfoFilePathInPosix)
            const resp = await readFile(movieNfoFilePath)

            if(resp.error) {
                console.error(`[useRecognizeMovieByNfoMutation] unable to read movie.nfo file: ${movieNfoFilePath}`, resp.error)
                return undefined
            }

            if(resp.data === undefined) {
                console.error(`[useRecognizeMovieByNfoMutation] unexpected response body: no data`, resp)
                return undefined
            }

            const movieNfo = await parseMovieNfo(resp.data)

            const tmdbId = movieNfo?.tmdbid
            if(tmdbId !== undefined) {
                console.log(`found tmdbid in movie.nfo: ${tmdbId}`)
                return await getMovieByIdFromTmdb({ id: parseInt(tmdbId, 10), language })
            }

            const tvdbId = movieNfo?.tvdbid
            if(tvdbId !== undefined) {
                console.log(`found tvdbid in movie.nfo: ${tvdbId}`)
                return await getMovieByIdFromTvdb({ movieId: parseInt(tvdbId, 10), language })
            }

            console.warn(`[useRecognizeMovieByNfoMutation] no tmdbid or tvdbid found in movie.nfo`)
            return undefined
        },
    })

    return mutation;
}