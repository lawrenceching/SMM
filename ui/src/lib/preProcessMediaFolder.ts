import type { MediaMetadata, TMDBMovie, TMDBTVShow } from "@core/types";
import { searchTmdb, getTvShowById } from "@/api/tmdb";
import { basename } from "./path";
import { tryToRecognizeMediaFolderByNFO as doTryToRecognizeMediaFolderByNFO } from "@/components/TvShowPanelUtils";
import { listFiles } from "@/api/listFiles";
import { Path } from "@core/path";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";

export interface RecognizeMediaFolderResult {
    success: boolean;
    type?: 'tv' | 'movie' | null;
    tmdbTvShow?: TMDBTVShow;
    tmdbMovie?: TMDBMovie;
}

export async function tryToRecognizeMediaFolderByFolderName(
    folderPath: string,
    language: 'zh-CN' | 'en-US' | 'ja-JP' = 'en-US'
): Promise<RecognizeMediaFolderResult> {

    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return { success: false }
    }

    try {
        // Search TMDB for both TV shows and movies
        const [tvResponse, movieResponse] = await Promise.all([
            searchTmdb(folderName, 'tv', language),
            searchTmdb(folderName, 'movie', language)
        ]);

        // Check for errors in responses
        if (tvResponse.error || movieResponse.error) {
            console.error('[tryToRecognizeMediaFolderByFolderName] TMDB search error:', {
                tvError: tvResponse.error,
                movieError: movieResponse.error
            });
            return { success: false };
        }

        // Store results separately
        const tvShowSearchResults = tvResponse.results as TMDBTVShow[];
        const movieSearchResults = movieResponse.results as TMDBMovie[];


        for(const item of tvShowSearchResults) {
            console.log(`[tryToRecognizeMediaFolderByFolderName] TV result: ${item.name} ${item.id}`)
            if(folderName === item.name) {
                return {
                    success: true,
                    type: 'tv',
                    tmdbTvShow: item,
                }
            }
        }

        // Log movie results
        movieSearchResults.forEach(item => {
            console.log(`[tryToRecognizeMediaFolderByFolderName] Movie result: ${item.title} ${item.id}`)
        });

        for(const item of movieSearchResults) {
            console.log(`[tryToRecognizeMediaFolderByFolderName] Movie result: ${item.title} ${item.id}`)
            if(folderName === item.title) {
                return {
                    success: true,
                    type: 'movie',
                    tmdbMovie: item,
                }
            }
        }

        return {
            success: false,
        }        

    } catch (error) {
        console.error('[tryToRecognizeMediaFolderByFolderName] Exception:', error);
        return { success: false };
    }
}

export async function tryToRecognizeMediaFolderByNFO(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {

    const resp = await listFiles({ path: folderPath, onlyFiles: true, recursively: true })
    if(resp.error) {
        console.error('[preprocessMediaFolder] failed to list files:', resp.error)
        return { success: false }
    }
    if(resp.data === undefined) {
        console.error('[preprocessMediaFolder] failed to list files:', resp)
        return { success: false }
    }
    const files = resp.data.items.map(item => Path.posix(item.path))

    const mm: MediaMetadata = {
        mediaFolderPath: folderPath,
        files: files,
    }
    const mmRecognizedByNFO = await doTryToRecognizeMediaFolderByNFO(mm, signal)
    if(mmRecognizedByNFO !== undefined) {
        return {
            success: true,
            type: mmRecognizedByNFO.type as 'tv' | 'movie' | null,
            tmdbTvShow: mmRecognizedByNFO.tmdbTvShow,
            tmdbMovie: mmRecognizedByNFO.tmdbMovie,
        }
    }

    return {
        success: false,
    }
}

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

export async function preprocessMediaFolder(folderPath: string, signal?: AbortSignal): Promise<RecognizeMediaFolderResult> {

    console.log(`[preprocessMediaFolder] preprocess media folder: ${folderPath}`)
    
    //1. try to recognize media folder by NFO
    try {
        const mmRecognizedByNFO = await tryToRecognizeMediaFolderByNFO(folderPath, signal)
        if(mmRecognizedByNFO.success) {
            console.log(`[preprocessMediaFolder] successfully recognized media folder by NFO: ${mmRecognizedByNFO.tmdbTvShow?.name} ${mmRecognizedByNFO.tmdbTvShow?.id}`)
            return mmRecognizedByNFO;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByNFO:`, error)
    }

    //2.: try to recognize media folder by TMDB ID in folder name
    try {
        const mmRecognizedByTmdbIdInFolderName = await tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath, signal)
        if(mmRecognizedByTmdbIdInFolderName.success) {
            console.log(`[preprocessMediaFolder] successfully recognized media folder by TMDB ID in folder name: ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.name} ${mmRecognizedByTmdbIdInFolderName.tmdbTvShow?.id}`)
            return mmRecognizedByTmdbIdInFolderName;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByTmdbIdInFolderName:`, error)
    }

    //3. try to recognize media folder by folder name
    try {
        const mmRecognizedByFolderName = await tryToRecognizeMediaFolderByFolderName(folderPath, 'zh-CN')
        if(mmRecognizedByFolderName.success) {
           console.log(`[preprocessMediaFolder] successfully recognized media folder by folder name: ${mmRecognizedByFolderName.tmdbTvShow?.name} ${mmRecognizedByFolderName.tmdbTvShow?.id}`)
           return mmRecognizedByFolderName;
        }
    } catch (error) {
        console.error(`[preprocessMediaFolder] Error in tryToRecognizeMediaFolderByFolderName:`, error)
    }

    return {
        success: false,
    }
}
