import type { MediaMetadata, TMDBMovie, TMDBTVShow } from "@core/types";
import { searchTmdb, getTvShowById } from "@/api/tmdb";
import { basename } from "./path";


export interface RecognizeMediaFolderResult {
    success: boolean;
    type?: 'tv' | 'movie' | null;
    tmdbTvShow?: TMDBTVShow;
    tmdbMovie?: TMDBMovie;
}

export async function tryToRecognizeMediaFolderByFolderName(
    folderName: string,
    language: 'zh-CN' | 'en-US' | 'ja-JP' = 'en-US'
): Promise<RecognizeMediaFolderResult> {
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

export async function preprocessMediaFolder(folderPath: string): Promise<RecognizeMediaFolderResult> {

    console.log(`[preprocessMediaFolder] preprocess media folder: ${folderPath}`)
    // TODO: try to recognize media folder by NFO

    // TODO: try to recognize media folder by TMDB ID in folder name

    // TODO: try to recognize media folder by folder name

    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return { success: false }
    }
    const result = await tryToRecognizeMediaFolderByFolderName(folderName, 'zh-CN');
    if(result.success) {
        if(result.type === 'tv') {
            console.log(`[preprocessMediaFolder] successfully recognized media folder: ${result.tmdbTvShow?.name} ${result.tmdbTvShow?.id}`)
            
        } else if(result.type === 'movie') {
            console.log(`[preprocessMediaFolder] successfully recognized media folder: ${result.tmdbMovie?.title} ${result.tmdbMovie?.id}`)
        }
    }

    return result;
}