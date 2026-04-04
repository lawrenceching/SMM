import { getMovieById, getTvShowById } from "@/api/tmdb";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";
import type { MovieMediaMetadata, PreferMediaLanguage, TMDBMovie, TvShowMediaMetadata } from "@core/types";

function movieMediaMetadataFromTmdbMovie(movie: TMDBMovie): MovieMediaMetadata {
  const name = movie.title?.trim() || movie.original_title?.trim() || "";
  return {
    id: String(movie.id),
    name,
    database: "TMDB",
  };
}

// TODO: use tanstack query instead
export async function getTvShowByIdFromTMDB(
    id: number, 
    language?: PreferMediaLanguage, 
    signal?: AbortSignal): Promise<TvShowMediaMetadata> {
    const resp = await getTvShowById(id, language, signal);
    if (resp.error) {
        throw new Error(resp.error);
    }
    if (resp.data === undefined) {
        throw new Error(`TMDB returned no TV show data for id ${id}`);
    }
    return tvShowMediaMetadataFromTmdbDetails(resp.data);
}

export async function getMovieByIdFromTMDB(
    id: number, 
    language?: PreferMediaLanguage, 
    signal?: AbortSignal): Promise<MovieMediaMetadata> {
    const resp = await getMovieById(id, language, signal);
    if (resp.error) {
        throw new Error(resp.error);
    }
    if (resp.data === undefined) {
        throw new Error(`TMDB returned no movie data for id ${id}`);
    }
    return movieMediaMetadataFromTmdbMovie(resp.data);
}