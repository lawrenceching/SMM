import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeTvShowFolderByNFO } from "@/components/TvShowPanelUtils";
import { Path } from "@core/path";
import { readFile } from "@/api/readFile";
import { parseMovieNfo, parseTvShowNfo } from "@/lib/nfo";
import { getMovieById } from "@/api/tmdb";
import { useMutation } from "@tanstack/react-query";
import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types";
import { useTmdbQueries } from "@/hooks/useTmdbQueries";
import { useTvdbQueries } from "@/hooks/useTvdbQueries";
import { useGetTmdbTvShowMutation } from "@/hooks/useGetTmdbTvShowMutation";
import { useGetTvdbTvShowMutation } from "@/hooks/useGetTvdbTvShowMutation";
import { useGetTmdbMovieMutation } from "@/hooks/useGetTmdbMovieMutation";
import { useGetTvdbMovieMutation } from "@/hooks/useGetTvdbMovieMutation";

export async function tryToRecognizeMediaFolderByNFO(_in_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {
    const mm = await tryToRecognizeTvShowFolderByNFO(_in_mm, signal)
    if(mm !== undefined) {
        return mm;
    }

    return await tryRecognizeMovieByNFO(_in_mm, signal)
}

export function useRecognizeTvShowByNfoMutation() {

    const { mutateAsync: getTvShowByIdFromTmdb } = useGetTmdbTvShowMutation()
    const { mutateAsync: getTvShowByIdFromTvdb } = useGetTvdbTvShowMutation()
 
    const mutation = useMutation({
        mutationFn: async (_variables: { mediaMetadata: UIMediaMetadata }): Promise<TvShowMediaMetadata | undefined> => {

            const m = _variables.mediaMetadata;
            
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
                return await getTvShowByIdFromTmdb({ id: parseInt(tmdbId, 10) })
            }

            const tvdbId = tvShowNfo?.tvdbid
            if(tvdbId !== undefined) {
                console.log(`found tvdbid in tvshow.nfo: ${tvdbId}`)
                return await getTvShowByIdFromTvdb({ seriesId: parseInt(tvdbId, 10) })
            }

            console.warn(`[useRecognizeTvShowByNfoMutation] no tmdbid or tvdbid found in tvshow.nfo`)
            return undefined
        },
    })

    return mutation;
}

export function useRecognizeMovieByNfoMutation() {
    const { mutateAsync: getMovieByIdFromTmdb } = useGetTmdbMovieMutation()
    const { mutateAsync: getMovieByIdFromTvdb } = useGetTvdbMovieMutation()

    const mutation = useMutation({
        mutationFn: async (_variables: { mediaMetadata: UIMediaMetadata }): Promise<MovieMediaMetadata | undefined> => {
            const m = _variables.mediaMetadata;
            
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
                return await getMovieByIdFromTmdb({ id: parseInt(tmdbId, 10) })
            }

            const tvdbId = movieNfo?.tvdbid
            if(tvdbId !== undefined) {
                console.log(`found tvdbid in movie.nfo: ${tvdbId}`)
                return await getMovieByIdFromTvdb({ movieId: parseInt(tvdbId, 10) })
            }

            console.warn(`[useRecognizeMovieByNfoMutation] no tmdbid or tvdbid found in movie.nfo`)
            return undefined
        },
    })

    return mutation;
}

/**
 * Try to recognize the media folder as movie by NFO.
 * @deprecated
 * @param _in_mm
 * @param signal
 */
export async function tryRecognizeMovieByNFO(_in_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {
    const mm = structuredClone(_in_mm)

    if (mm.files === undefined || mm.files === null) {
        console.log(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: files is undefined or null`)
        return undefined
    }

    mm.mediaFiles = mm.mediaFiles ?? []

    // Find movie NFO file: any .nfo file in folder root that contains <movie> element
    // Exclude tvshow.nfo (TV show files)
    const nfoFilePath = mm.files.find(file =>
        file.endsWith('.nfo') &&
        !file.endsWith('/tvshow.nfo')
    )

    if (nfoFilePath === undefined) {
        console.log(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: no movie NFO file found`)
        return undefined
    }

    const resp = await readFile(Path.toPlatformPath(nfoFilePath), signal)

    if (resp.error) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: unable to read NFO file: ${nfoFilePath}`, resp.error)
        return undefined
    }

    if (resp.data === undefined) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: unexpected response body: no data`, resp)
        return undefined
    }

    // Check if it's a movie NFO by parsing and checking for <movie> element
    const movieNfo = await parseMovieNfo(resp.data)

    if (movieNfo === undefined) {
        console.log(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: NFO file does not contain <movie> element: ${nfoFilePath}`)
        return undefined
    }

    // Validate required fields
    if (!movieNfo.tmdbid) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: missing tmdbid in movie NFO: ${nfoFilePath}`, {
            title: movieNfo.title,
            year: movieNfo.year,
            tmdbid: movieNfo.tmdbid
        })
        return undefined
    }

    // Get movie info from TMDB using the ID from NFO file
    // This ensures SMM always uses the latest and correct movie info from TMDB
    const tmdbIdNumber = parseInt(movieNfo.tmdbid, 10)
    if (isNaN(tmdbIdNumber) || tmdbIdNumber <= 0) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: invalid tmdbid in movie NFO: ${nfoFilePath}`, {
            tmdbid: movieNfo.tmdbid
        })
        return undefined
    }

    const movieResp = await getMovieById(tmdbIdNumber, 'zh-CN', signal)

    if (movieResp.error) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: failed to get movie from TMDB: ${movieResp.error}`)
        return undefined
    }

    if (movieResp.data === undefined) {
        console.error(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: no movie data returned from TMDB`)
        return undefined
    }

    mm.tmdbMovie = movieResp.data
    mm.type = 'movie-folder'

    console.log(`[recognizeMediaFolderByNFO] tryRecognizeMovieByNFO: successfully recognized movie: ${movieResp.data.title} (${movieResp.data.id})`)

    return mm
}