import type {
  TMDBTVShowDetails,
  TvShowEpisodeMetadata,
  TvShowMediaMetadata,
  TvShowSeasonMetadata,
} from "@core/types";

/** TMDB details → unified `tvShow` shape (same as TVDB-backed metadata). */
export function tvShowMediaMetadataFromTmdbDetails(
  details: TMDBTVShowDetails
): TvShowMediaMetadata {
  const seasons: TvShowSeasonMetadata[] = (details.seasons ?? []).map((season) => {
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
    id: String(details.id),
    name: details.name,
    database: "TMDB",
    airDate: details.first_air_date,
    seasons,
  };
}
