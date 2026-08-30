import type { PreferMediaLanguage } from "@smm/types"

export function tmdbTvShowByIdQueryKey(
  id: number,
  language?: PreferMediaLanguage | string
) {
  return ["tmdb", "tv", id, language] as const
}

export function tmdbTvShowSeasonQueryKey(
  seriesId: number,
  seasonNumber: number,
  language?: PreferMediaLanguage | string
) {
  return ["tmdb", "tv", seriesId, "season", seasonNumber, language] as const
}

export function tmdbMovieByIdQueryKey(id: number, language?: PreferMediaLanguage | string) {
  return ["tmdb", "movie", id, language] as const
}
