import { basename } from "./path";
import { getTmdbIdFromFolderName } from "@/AppV2Utils";
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { getMovieByIdFromTMDB } from "./TmdbUtils";

export async function tryToRecognizeMediaFolderByTmdbIdInFolderName(
    getTvShowByIdFromTmdbFn: (id: number, language?: PreferMediaLanguage) => Promise<TvShowMediaMetadata>,
    folderPath: string, language: PreferMediaLanguage, signal?: AbortSignal): Promise<{
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

    const tvShow = await getTvShowByIdFromTmdbFn(tmdbIdNumber, language)
    if(tvShow) {
        return {
            tvShow: tvShow,
        };
    }
    
    // Try to get movie by TMDB ID
    // TODO: use mutation instead
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
