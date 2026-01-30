import { getTvShowById } from "@/api/tmdb";
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
    
    // TODO: get movie by TMDB ID
    console.log(`[tryToRecognizeMediaFolderByTmdbIdInFolderName] TODO: get movie by TMDB ID: ${tmdbIdNumber}`)

    return { }


}
