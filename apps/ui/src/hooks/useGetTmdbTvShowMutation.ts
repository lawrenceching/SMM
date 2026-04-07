import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import type { PreferMediaLanguage, TmdbSeriesDetails, TmdbSeasonDetails, TvShowMediaMetadata, TvShowSeasonMetadata, TvShowEpisodeMetadata } from "@core/types"

/**
 * Fetches TMDB TV details via cached HTTP (`fetchQuery`) and maps to {@link TvShowMediaMetadata}.
 * Pass `onMutate` / `onSuccess` / `onError` (and optional `meta` via variables) for component-specific UI updates.
 */
export function useGetTmdbTvShowMutation<
  TVariables extends { id: number; language?: PreferMediaLanguage },
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<TvShowMediaMetadata, Error, TVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowById, getTvShowSeasonDetails } = useTmdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      console.log(`useGetTmdbTvShowMutation CALLED`, {...variables})
      const tmdbTvSeriesDetails: TmdbSeriesDetails = await getTvShowById(variables.id, variables.language)

      const seasonDetails: TmdbSeasonDetails[] = []
      for(const season of tmdbTvSeriesDetails.seasons) {
        const tmdbTvShowSeasonDetails: TmdbSeasonDetails = await getTvShowSeasonDetails(variables.id, season.season_number, variables.language)
        seasonDetails.push(tmdbTvShowSeasonDetails)
      }
      
      return buildTvShowMediaMetadata(tmdbTvSeriesDetails, seasonDetails)
    },
  })
}

export function buildTvShowMediaMetadata(
  tmdbTvSeriesDetails: TmdbSeriesDetails,
  seasonDetails: TmdbSeasonDetails[],
): TvShowMediaMetadata {
  const seasons: TvShowSeasonMetadata[] = (seasonDetails ?? []).map((season) => {
    const episodes: TvShowEpisodeMetadata[] = (season.episodes ?? []).map((ep) => ({
      season: ep.season_number,
      episode: ep.episode_number,
      name: ep.name ?? "",
    }));
    return {
      season: season.season_number,
      name: season.name ?? "",
      episodes,
    };
  });

  return {
    id: String(tmdbTvSeriesDetails.id),
    name: tmdbTvSeriesDetails.name,
    database: "TMDB",
    airDate: tmdbTvSeriesDetails.first_air_date,
    seasons,
  };
}