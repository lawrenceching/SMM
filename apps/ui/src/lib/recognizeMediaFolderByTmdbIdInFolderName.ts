import { basename } from "./path";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { getMovieByIdFromTMDB, getTvShowByIdFromTMDB } from "./TmdbUtils";

export async function tryToRecognizeMediaFolderByTmdbIdInFolderName(folderPath: string, language: PreferMediaLanguage, signal?: AbortSignal): Promise<{
    tvShow?: TvShowMediaMetadata;
    movie?: MovieMediaMetadata;
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

    const tvShow = await getTvShowByIdFromTMDB(tmdbIdNumber, language, signal)
    if(tvShow) {
        return {
            tvShow: tvShow,
        };
    }
    
    // Try to get movie by TMDB ID
    const movie = await getMovieByIdFromTMDB(tmdbIdNumber, language, signal);
    
    if(movie) {
        return {
            movie: movie,
        };
    }

    return {
        tvShow: undefined,
        movie: undefined,
    }
}
