import { getTvShowById } from "@/api/tmdb";
import { basename } from "./path";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";

export async function tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {
    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return { success: false }
    }
    const tmdbId = getTmdbIdFromFolderName(folderName);
    if(tmdbId === null) {
        console.error('[preprocessMediaFolder] TMDB ID is null')
        return { success: false }
    }
    const tmdbIdNumber = parseInt(tmdbId, 10);
    if(isNaN(tmdbIdNumber) || tmdbIdNumber <= 0) {
        console.error('[preprocessMediaFolder] TMDB ID is not a valid number')
        return { success: false }
    }

    const resp = await getTvShowById(tmdbIdNumber, 'zh-CN', signal)
    if(resp.error) {
        console.error('[preprocessMediaFolder] failed to get TV show by ID:', resp.error)
        return { success: false }
    }
    if(resp.data === undefined) {
        console.error('[preprocessMediaFolder] failed to get TV show by ID:', resp)
        return { success: false }
    }

    return {
        success: true,
        type: 'tv',
        tmdbTvShow: resp.data,
    }
}
