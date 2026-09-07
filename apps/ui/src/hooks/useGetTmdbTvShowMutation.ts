
import type { TmdbSeriesDetails, TmdbSeasonDetails, TvShowMediaMetadata, TvShowSeasonMetadata, TvShowEpisodeMetadata } from "@smm/types"

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