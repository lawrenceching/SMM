import { getMovieById, getTvShowById } from "@/api/tmdb";
import { tvShowMediaMetadataFromTmdbDetails } from "./tvShowMediaMetadataFromTmdbDetails";
import type {
  MovieMediaMetadata,
  PreferMediaLanguage,
  TMDBMovie,
  TmdbSeriesDetails,
  TvShowMediaMetadata,
} from "@core/types";

function movieMediaMetadataFromTmdbMovie(movie: TMDBMovie): MovieMediaMetadata {
  const name = movie.title?.trim() || movie.original_title?.trim() || "";
  return {
    id: String(movie.id),
    name,
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
    const resp = await getMovieById(id, language, signal);
    if (resp.error) {
        throw new Error(resp.error);
    }
    if (resp.data === undefined) {
        throw new Error(`TMDB returned no movie data for id ${id}`);
    }
    return movieMediaMetadataFromTmdbMovie(resp.data);
}