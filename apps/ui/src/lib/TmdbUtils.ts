import { getMovieById, getTvShowById } from "@/api/tmdb";
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
  id: number
): TvShowMediaMetadata {
  return tvShowMediaMetadataFromTmdbDetails(details);
}

/**
 * @deprecated, use useTmdbQueries instead
 */
export async function getTvShowByIdFromTMDB(
  id: number,
  language?: PreferMediaLanguage,
  signal?: AbortSignal
): Promise<TvShowMediaMetadata> {
  const details = await getTvShowById(id, language, signal);
  return buildTvShowMediaMetadataFromTmdbSeriesDetails(details, id);
}

export async function getMovieByIdFromTMDB(
    id: number, 
    language?: PreferMediaLanguage, 
    signal?: AbortSignal): Promise<MovieMediaMetadata> {
    const movie = await getMovieById(id, language, signal);
    return movieMediaMetadataFromTmdbMovie(movie);
}