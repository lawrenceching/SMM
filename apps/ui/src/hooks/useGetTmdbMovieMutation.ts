
import type { MovieMediaMetadata, TmdbMovieDetails } from "@smm/types"

export function buildMovieMediaMetadata(tmdbMovieDetails: TmdbMovieDetails): MovieMediaMetadata {
  const name =
    (tmdbMovieDetails.title && tmdbMovieDetails.title.trim().length > 0
      ? tmdbMovieDetails.title
      : tmdbMovieDetails.original_title) ?? ""

  return {
    id: String(tmdbMovieDetails.id),
    name,
    airDate: tmdbMovieDetails.release_date,
    database: "TMDB",
  }
}
