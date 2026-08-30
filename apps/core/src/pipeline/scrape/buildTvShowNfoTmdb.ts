import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/types";
import type { EpisodeNfo, TvShowNFO } from "./nfoTypes";
import { getTmdbImageUrl } from "./tmdbImageUrl";

type TmdbSeriesDetailsWithExtras = TmdbSeriesDetails & {
  logo_path?: string | null;
  genres?: Array<{ name: string }>;
  production_countries?: Array<{ name: string }>;
};

type TmdbEpisodeDetails = NonNullable<TmdbSeasonDetails["episodes"]>[number];

export function buildTvShowNfo(
  tmdbTvSeriesDetails: TmdbSeriesDetails,
  tmdbTvShowSeasons: TmdbSeasonDetails[],
): TvShowNFO {
  const series = tmdbTvSeriesDetails as TmdbSeriesDetailsWithExtras;
  const thumbs: TvShowNFO["thumbs"] = [];
  const namedSeasons: TvShowNFO["namedSeasons"] = [];

  const poster = getTmdbImageUrl(series.poster_path, "original");
  if (poster) {
    thumbs.push({
      url: poster,
      aspect: "poster",
    });
  }

  const clearLogo = getTmdbImageUrl(series.logo_path, "original");
  if (clearLogo) {
    thumbs.push({
      url: clearLogo,
      aspect: "clearlogo",
    });
  }

  for (const season of tmdbTvShowSeasons ?? []) {
    namedSeasons.push({
      number: season.season_number,
      name: season.name,
    });
    const seasonPoster = getTmdbImageUrl(season.poster_path, "original");
    if (seasonPoster) {
      thumbs.push({
        url: seasonPoster,
        aspect: "poster",
        season: season.season_number,
        type: "season",
      });
    }
  }

  const fanart = getTmdbImageUrl(series.backdrop_path, "original");
  const runtime =
    (tmdbTvShowSeasons ?? [])
      .flatMap((s) => s.episodes ?? [])
      .find((ep) => typeof ep.runtime === "number" && ep.runtime > 0)?.runtime;

  return {
    title: series.name,
    originalTitle: series.original_name,
    showTitle: series.name,
    year: parseInt(series.first_air_date?.slice(0, 4) ?? "", 10) || undefined,
    top250: 0,
    ratings: [
      {
        default: true,
        max: 10,
        name: "themoviedb",
        value: series.vote_average,
        votes: series.vote_count,
      },
    ],
    userRating: 0,
    outline: series.overview,
    plot: series.overview,
    tagline: undefined,
    runtime,
    thumbs: thumbs.length > 0 ? thumbs : undefined,
    namedSeasons: namedSeasons.length > 0 ? namedSeasons : undefined,
    fanartThumbs: fanart ? [fanart] : undefined,
    episodeguide: JSON.stringify({ tmdb: String(series.id) }),
    id: String(series.id),
    tmdbid: String(series.id),
    uniqueIds: [
      {
        default: true,
        type: "tmdb",
        value: String(series.id),
      },
    ],
    premiered: series.first_air_date,
    status: series.status,
    watched: false,
    genres: series.genres?.map((g) => g.name).filter(Boolean),
    studios: (series.production_companies ?? []).map((c) => c.name).filter(Boolean),
    countries: series.production_countries?.map((c) => c.name).filter(Boolean),
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

export function buildTvShowEpisodeNfo(
  tmdbTvSeriesDetails: TmdbSeriesDetails,
  tmdbSeason: TmdbSeasonDetails,
  tmdbEpisode: TmdbEpisodeDetails,
): EpisodeNfo {
  const thumb = getTmdbImageUrl(tmdbEpisode.still_path, "original") ?? undefined;
  const studios =
    (tmdbTvSeriesDetails.production_companies ?? [])
      .map((company) => company.name)
      .filter(Boolean);

  const directors = (tmdbEpisode.crew ?? [])
    .filter((crew) => crew.job === "Director")
    .map((crew) => ({
      tmdbid: String(crew.id),
      name: crew.name,
    }));

  const credits = (tmdbEpisode.crew ?? [])
    .filter((crew) => crew.department === "Writing")
    .map((crew) => ({
      tmdbid: String(crew.id),
      name: crew.name,
    }));

  const actors = (tmdbEpisode.guest_stars ?? []).map((guest) => ({
    name: guest.name,
    role: guest.character,
    thumb: getTmdbImageUrl(guest.profile_path, "original") ?? undefined,
    profile: `https://www.themoviedb.org/person/${guest.id}`,
    type: "GuestStar",
    tmdbid: String(guest.id),
  }));

  return {
    id: String(tmdbEpisode.id),
    title: tmdbEpisode.name,
    originalTitle: tmdbEpisode.name,
    showTitle: tmdbTvSeriesDetails.name,
    season: tmdbSeason.season_number,
    episode: tmdbEpisode.episode_number,
    uniqueIds: [
      {
        default: true,
        type: "tmdb",
        value: String(tmdbEpisode.id),
      },
    ],
    ratings:
      tmdbEpisode.vote_average > 0 || tmdbEpisode.vote_count > 0
        ? [
            {
              default: false,
              max: 10,
              name: "themoviedb",
              value: tmdbEpisode.vote_average,
              votes: tmdbEpisode.vote_count,
            },
          ]
        : undefined,
    userRating: 0,
    plot: tmdbEpisode.overview,
    runtime: tmdbEpisode.runtime > 0 ? tmdbEpisode.runtime : undefined,
    thumb,
    premiered: tmdbEpisode.air_date,
    aired: tmdbEpisode.air_date,
    watched: false,
    playcount: 0,
    studios: studios.length > 0 ? studios : undefined,
    credits: credits.length > 0 ? credits : undefined,
    directors: directors.length > 0 ? directors : undefined,
    actors: actors.length > 0 ? actors : undefined,
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}
