import { getMovieById, getTvShowById } from "@/api/tmdb";
import { basename } from "./path";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";
import type { TMDBMovie, TMDBTVShowDetails } from "@core/types";

export async function tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath: string, signal?: AbortSignal): Promise<{
    tmdbTvShow?: TMDBTVShowDetails;
    tmdbMovie?: TMDBMovie;
}> {
    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return { }
    }
    const tmdbId = getTmdbIdFromFolderName(folderName);
    if(tmdbId === null) {
        console.error('[preprocessMediaFolder] TMDB ID is null')
        return { }
    }
    const tmdbIdNumber = parseInt(tmdbId, 10);
    if(isNaN(tmdbIdNumber) || tmdbIdNumber <= 0) {
        console.error('[preprocessMediaFolder] TMDB ID is not a valid number')
        return { }
    }

    const resp = await getTvShowById(tmdbIdNumber, 'zh-CN', signal)
    if(resp.error) {
        console.error('[preprocessMediaFolder] failed to get TV show by ID:', resp.error)
    } else {
        if(resp.data === undefined) {
            console.error('[preprocessMediaFolder] failed to get TV show by ID:', resp)
        } else {
            console.log(`[tryToRecognizeMediaFolderByTmdbIdInFolderName] successfully recognized TV show by TMDB ID in folder name: ${resp.data?.name} ${resp.data?.id}`)
            return {
                tmdbTvShow: resp.data,
            }
        }
    }
    
    // Try to get movie by TMDB ID
    const movieResp = await getMovieById(tmdbIdNumber, 'zh-CN', signal);
    if (movieResp.error) {
        console.error('[tryToRecognizeMediaFolderByTmdbIdInFolderName] failed to get movie by ID:', movieResp.error);
        return {};
    }
    if (movieResp.data === undefined) {
        console.error('[tryToRecognizeMediaFolderByTmdbIdInFolderName] failed to get movie by ID:', movieResp);
        return {};
    }
    console.log(`[tryToRecognizeMediaFolderByTmdbIdInFolderName] successfully recognized movie by TMDB ID in folder name: ${movieResp.data?.title} ${movieResp.data?.id}`);
    return {
        tmdbMovie: movieResp.data,
    };


}
