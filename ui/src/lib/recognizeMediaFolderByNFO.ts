import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { tryToRecognizeTvShowFolderByNFO } from "@/components/TvShowPanelUtils";
import { Path } from "@core/path";
import { readFile } from "@/api/readFile";
import { parseMovieNfo } from "@/lib/nfo";
import { getMovieById } from "@/api/tmdb";

export async function tryToRecognizeMediaFolderByNFO(_in_mm: UIMediaMetadata, signal?: AbortSignal): Promise<UIMediaMetadata | undefined> {
    const mm = await tryToRecognizeTvShowFolderByNFO(_in_mm, signal)
    if(mm !== undefined) {
        return mm;
    }

    return await tryRecognizeMovieByNFO(_in_mm, signal)
}


/**
 * Try to recognize the media folder as movie by NFO.
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