import { getMovieById } from "@/api/tmdb";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";
import type {
  MovieMediaMetadata,
  PreferMediaLanguage,
  TmdbMovieDetails,
  TmdbSeriesDetails,
  TvShowMediaMetadata,
} from "@core/types";

function movieMediaMetadataFromTmdbMovie(movie: TmdbMovieDetails): MovieMediaMetadata {
  const name = movie.title?.trim() || movie.original_title?.trim() || "";
  return {
    id: String(movie.id),
    name,
    airDate: movie.release_date,
    database: "TMDB",
  };
}

/**
 * @deprecated
 * @param details 
 * @param id 
 * @returns 
 */
export function buildTvShowMediaMetadataFromTmdbSeriesDetails(
  details: TmdbSeriesDetails,
): TvShowMediaMetadata {
  return tvShowMediaMetadataFromTmdbDetails(details);
}

export async function getMovieByIdFromTMDB(
    id: number, 
    language?: PreferMediaLanguage, 
    signal?: AbortSignal): Promise<MovieMediaMetadata> {
    const movie = await getMovieById(id, language, signal);
    return movieMediaMetadataFromTmdbMovie(movie);
}