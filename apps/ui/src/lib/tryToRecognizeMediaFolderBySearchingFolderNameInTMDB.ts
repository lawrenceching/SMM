import type {
    MovieMediaMetadata,
    TMDBMovie,
    TMDBTVShow,
    TMDBTVShowDetails,
    TvShowMediaMetadata,
} from "@core/types";
import { searchTmdb } from "@/api/tmdb";
import { basename } from "./path";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";
import Debug from "debug";

const debug = Debug("tryToRecognizeMediaFolderBySearchingFolderNameInTMDB");

export type TryRecognizeTvShowFolderBySearchingFolderNameInTMDBResult =
    | { success: false }
    | { success: true; tmdbTvShow: TvShowMediaMetadata };

export type TryRecognizeMovieFolderBySearchingFolderNameInTMDBResult =
    | { success: false }
    | { success: true; tmdbMovie: MovieMediaMetadata };

export async function tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB(
    folderPath: string,
    language: "zh-CN" | "en-US" | "ja-JP" = "en-US",
): Promise<TryRecognizeTvShowFolderBySearchingFolderNameInTMDBResult> {
    const folderName = basename(folderPath);
    if (folderName === undefined) {
        console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB] folder name is undefined");
        return { success: false };
    }

    try {

        debug(`searching TV show from TMDB: ${folderName}`)
        const tvResponse = await searchTmdb(folderName, "tv", language);

        if (tvResponse.error) {
            console.error(
                "[tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB] TMDB search error:",
                tvResponse.error,
            );
            return { success: false };
        }

        const tvShowSearchResults = tvResponse.results as TMDBTVShow[];

        debug(`got results: ${tvShowSearchResults.slice(0, 3).map(i => i.name).join(', ')}${tvShowSearchResults.length > 3 ? ', ...': ''}`)

        // select the first item as recognized result
        if(tvShowSearchResults.length > 0) {
            const tvShow = tvShowMediaMetadataFromTmdbDetails(tvShowSearchResults[0] as TMDBTVShowDetails);
            return {
                success: true,
                tmdbTvShow: tvShow,
            };
        }

        return { success: false };
    } catch (error) {
        console.error("[tryToRecognizeTvShowFolderBySearchingFolderNameInTMDB] Exception:", error);
        return { success: false };
    }
}

export async function tryToRecognizeMovieFolderBySearchingFolderNameInTMDB(
    folderPath: string,
    language: "zh-CN" | "en-US" | "ja-JP" = "en-US",
): Promise<TryRecognizeMovieFolderBySearchingFolderNameInTMDBResult> {
    const folderName = basename(folderPath);
    if (folderName === undefined) {
        console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTMDB] folder name is undefined");
        return { success: false };
    }

    try {
        const movieResponse = await searchTmdb(folderName, "movie", language);

        if (movieResponse.error) {
            console.error(
                "[tryToRecognizeMovieFolderBySearchingFolderNameInTMDB] TMDB search error:",
                movieResponse.error,
            );
            return { success: false };
        }

        const movieSearchResults = movieResponse.results as TMDBMovie[];

        for (const item of movieSearchResults) {
            console.log(
                `[tryToRecognizeMovieFolderBySearchingFolderNameInTMDB] Movie result: ${item.title} ${item.id}`,
            );
            if (folderName === item.title) {
                const movie = movieMediaMetadataFromTmdbMovie(item);
                return {
                    success: true,
                    tmdbMovie: movie,
                };
            }
        }

        return { success: false };
    } catch (error) {
        console.error("[tryToRecognizeMovieFolderBySearchingFolderNameInTMDB] Exception:", error);
        return { success: false };
    }
}

function movieMediaMetadataFromTmdbMovie(item: TMDBMovie): MovieMediaMetadata {
    return {
        id: String(item.id),
        name: item.title,
        airDate: item.release_date,
        database: "TMDB",
    };
}
