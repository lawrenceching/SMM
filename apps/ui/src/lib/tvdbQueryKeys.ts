import type { PreferMediaLanguage } from "@core/types"
import type { TVDBv4SearchParams } from "@smm/tvdb4"

export function tvdbSearchQueryKey(params: TVDBv4SearchParams) {
  return [
    "tvdb",
    "search",
    params.query.trim(),
    params.type,
    params.language?.trim() ?? null,
    params.year ?? null,
    params.country?.trim() ?? null,
    params.director?.trim() ?? null,
    params.company?.trim() ?? null,
    params.network?.trim() ?? null,
    params.offset ?? null,
    params.limit ?? null,
    params.page ?? null,
  ] as const
}

export function tvdbArtworkTypesQueryKey() {
  return ["tvdb", "artworkTypes"] as const
}

export function tvdbSeriesExtendedQueryKey(seriesId: number) {
  return ["tvdb", "series", seriesId, "extended"] as const
}

export function tvdbSeasonExtendedQueryKey(seasonId: number) {
  return ["tvdb", "season", seasonId, "extended"] as const
}

export function tvdbTvShowMediaMetadataQueryKey(
  seriesId: number,
  language: PreferMediaLanguage
) {
  return ["tvdb", "tvShowMediaMetadata", seriesId, language] as const
}

export function tvdbMovieMediaMetadataQueryKey(
  movieId: number,
  language: PreferMediaLanguage
) {
  return ["tvdb", "movieMediaMetadata", movieId, language] as const
}
