import type { MovieMediaMetadata, TMDBMovie, TMDBTVShow, TMDBTVShowDetails } from "@core/types";
import { searchTmdb } from "@/api/tmdb";
import { basename } from "./path";
import type { RecognizeMediaFolderResult } from "./recognizeMediaFolderTypes";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";

export async function tryToRecognizeMediaFolderBySearchingFolderNameInTMDB(
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
                const tvShow = tvShowMediaMetadataFromTmdbDetails(item as TMDBTVShowDetails);
                return {
                    success: true,
                    type: 'tv',
                    tmdbTvShow: tvShow,
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
                const movie = movieMediaMetadataFromTmdbMovie(item);
                return {
                    success: true,
                    type: 'movie',
                    tmdbMovie: movie,
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
function movieMediaMetadataFromTmdbMovie(item: TMDBMovie): MovieMediaMetadata {
    return {
        id: String(item.id),
        name: item.title,
        database: "TMDB",
    }
}

