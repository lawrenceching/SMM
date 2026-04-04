import type { PreferMediaLanguage } from "@core/types"

export function tmdbTvShowByIdQueryKey(
  id: number,
  language?: PreferMediaLanguage
) {
  return ["tmdb", "tv", id, language] as const
}
