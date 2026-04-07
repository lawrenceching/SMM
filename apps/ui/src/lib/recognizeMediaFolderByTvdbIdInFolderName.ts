import { basename } from "./path";
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@core/types";
import { fetchTvdbAndBuildMovieMediaMetadata } from "./TvdbUtils";

export function getTvdbIdFromFolderName(folderName: string): string | null {
    // Match patterns like (tmdbid=123456), {tmdbid=123456}, or [tmdbid=123456]
    const match = folderName.match(/[\(\{\[]\s*tvdbid\s*=\s*(\d+)\s*[\}\)\]]/i);
    return match ? match[1] : null;
}

export async function tryToRecognizeMediaFolderByTvdbIdInFolderName(
    folderPath: string, 
    type: 'tvshow' | 'movie',
    preferLanguage: PreferMediaLanguage,
    getTvShowByIdFromTvdbFn: (
        seriesId: number,
        language?: PreferMediaLanguage
    ) => Promise<TvShowMediaMetadata>,
    _signal?: AbortSignal): Promise<{
    tvdbTvShow?: TvShowMediaMetadata;
    tvdbMovie?: MovieMediaMetadata;
}> {
    const folderName = basename(folderPath);
    if(folderName === undefined) {
        console.error('[preprocessMediaFolder] folder name is undefined')
        return { }
    }
    const tvdbId = getTvdbIdFromFolderName(folderName);
    if(tvdbId === null) {
        console.error('[preprocessMediaFolder] TMDB ID is null')
        return { }
    }
    const tvdbIdNumber = parseInt(tvdbId, 10);
    if(isNaN(tvdbIdNumber) || tvdbIdNumber <= 0) {
        console.error('[preprocessMediaFolder] TMDB ID is not a valid number')
        return { }
    }

    let tvdbTvShow: TvShowMediaMetadata | undefined = undefined;
    let tvdbMovie: MovieMediaMetadata | undefined = undefined;


    if(type === 'tvshow') {
        try {
            tvdbTvShow = await getTvShowByIdFromTvdbFn(tvdbIdNumber, preferLanguage)
        } catch (error) {
            console.error('[preprocessMediaFolder] failed to get TV show by ID:', error)
        }
    } else {
        try {
            tvdbMovie = await fetchTvdbAndBuildMovieMediaMetadata(tvdbIdNumber, preferLanguage, {
                onMovieAPIError: (error: Error) => {
                    console.error('[preprocessMediaFolder] failed to get TVDB movie by ID:', error)
                },
            })
        } catch (error) {
            console.error('[preprocessMediaFolder] failed to get movie by ID:', error)
        }
    }
    

    

    return {
        tvdbTvShow,
        tvdbMovie,
    }
   
}
