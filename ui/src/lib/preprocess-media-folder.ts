import type { MediaMetadata, TMDBMovie } from "@core/types";
import { searchTmdb, getTvShowById } from "@/api/tmdb";
import { basename } from "./path";


interface RecognizeMediaFolderResult {
    success: boolean;
    type: 'tv' | 'movie' | null;
    metadata: Partial<MediaMetadata> | null;
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
            return { success: false, type: null, metadata: null };
        }

        // Combine both result sets
        const allResults = [...tvResponse.results, ...movieResponse.results];

        // Filter duplicate results by TMDB ID
        const uniqueResults = allResults.filter((item, index, self) =>
            index === self.findIndex(t => t.id === item.id)
        );

        // Only proceed if exactly one unique result is found
        if (uniqueResults.length !== 1) {
            console.log('[tryToRecognizeMediaFolderByFolderName] Found', uniqueResults.length, 'results for folder:', folderName);
            return { success: false, type: null, metadata: null };
        }

        const result = uniqueResults[0];

        // Distinguish between TV shows and movies
        if ('name' in result) {
            // It's a TV show - fetch full details including seasons and episodes
            const tvShowDetailsResponse = await getTvShowById(result.id, language);

            if (tvShowDetailsResponse.error || !tvShowDetailsResponse.data) {
                console.error('[tryToRecognizeMediaFolderByFolderName] Failed to fetch TV show details:', {
                    tmdbId: result.id,
                    error: tvShowDetailsResponse.error
                });
                return { success: false, type: null, metadata: null };
            }

            return {
                success: true,
                type: 'tv',
                metadata: {
                    tmdbTvShow: tvShowDetailsResponse.data,
                    tmdbMediaType: 'tv',
                    type: 'tvshow-folder'
                }
            };
        } else if ('title' in result) {
            // It's a movie - use the search result directly
            return {
                success: true,
                type: 'movie',
                metadata: {
                    tmdbMovie: result as TMDBMovie,
                    tmdbMediaType: 'movie',
                    type: 'movie-folder'
                }
            };
        }

        // Unknown result type
        console.warn('[tryToRecognizeMediaFolderByFolderName] Unknown result type:', result);
        return { success: false, type: null, metadata: null };

    } catch (error) {
        console.error('[tryToRecognizeMediaFolderByFolderName] Exception:', error);
        return { success: false, type: null, metadata: null };
    }
}

export async function preprocessMediaFolder(folderPath: string) {


    // TODO: try to recognize media folder by NFO

    // TODO: try to recognize media folder by TMDB ID in folder name

    // TODO: try to recognize media folder by folder name

    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return
    }
    const result = await tryToRecognizeMediaFolderByFolderName(folderName, 'zh-CN');
    if(result.success) {
        if(result.type === 'tv') {
            console.log(`[preprocessMediaFolder] successfully recognized media folder: ${result.metadata?.tmdbTvShow?.name} ${result.metadata?.tmdbTvShow?.id}`)
        } else if(result.type === 'movie') {
            console.log(`[preprocessMediaFolder] successfully recognized media folder: ${result.metadata?.tmdbMovie?.title} ${result.metadata?.tmdbMovie?.id}`)
        }
        
    }
}