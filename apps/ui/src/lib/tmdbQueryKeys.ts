import type { PreferMediaLanguage } from "@core/types"

export function tmdbTvShowByIdQueryKey(
  id: number,
  language?: PreferMediaLanguage
) {
  return ["tmdb", "tv", id, language] as const
}

export function tmdbTvShowSeasonQueryKey(
  seriesId: number,
  seasonNumber: number,
  language?: PreferMediaLanguage
) {
  return ["tmdb", "tv", seriesId, "season", seasonNumber, language] as const
}

export function tmdbMovieByIdQueryKey(id: number, language?: PreferMediaLanguage) {
  return ["tmdb", "movie", id, language] as const
}
