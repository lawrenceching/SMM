import type {
  TVDBv4MovieBaseRecord,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types";
import type { EpisodeNfo, MovieNFO, TvShowNFO } from "./nfoTypes";

type TvdbSeriesDetails = TVDBv4SeriesExtendedResponse;
type TvdbSeasonDetails = TVDBv4SeriesSeasonsExtendedResponse;
type TvdbEpisodeDetails = TVDBv4SeriesSeasonsExtendedResponse["episodes"][number];

function tvdbGetString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function tvdbGetNumber(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function buildTvShowNfoByTVDB(
  tvdbSeries: TvdbSeriesDetails,
  tvdbSeasons: TvdbSeasonDetails[],
  resolvedSeriesText?: { title?: string; overview?: string },
): TvShowNFO {
  const getSeasonNumber = (season: TvdbSeasonDetails): number | undefined =>
    season.episodes?.find((ep) => Number.isFinite(ep.seasonNumber))?.seasonNumber;

  const thumbs: TvShowNFO["thumbs"] = [];
  const namedSeasons: TvShowNFO["namedSeasons"] = (tvdbSeasons ?? []).map((season) => ({
    number: getSeasonNumber(season),
    name: "",
  }));

  if (tvdbSeries.image) {
    thumbs.push({ url: tvdbSeries.image, aspect: "poster" });
  }
  for (const season of tvdbSeasons ?? []) {
    const seasonNumber = getSeasonNumber(season);
    if (season.image) {
      thumbs.push({
        url: season.image,
        aspect: "poster",
        season: seasonNumber,
        type: "season",
      });
    }
  }

  const fanartThumb = (tvdbSeries.artworks ?? [])
    .filter((art) => typeof art.image === "string" && art.image.length > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.image;

  return {
    id: String(tvdbSeries.id),
    title: resolvedSeriesText?.title || tvdbSeries.name,
    originalTitle: resolvedSeriesText?.title || tvdbSeries.name,
    showTitle: resolvedSeriesText?.title || tvdbSeries.name,
    year: Number.parseInt(tvdbSeries.year ?? "", 10) || undefined,
    top250: 0,
    ratings:
      tvdbSeries.score > 0
        ? [{ default: true, max: 10, name: "tvdb", value: tvdbSeries.score }]
        : undefined,
    userRating: 0,
    outline: resolvedSeriesText?.overview || tvdbSeries.overview,
    plot: resolvedSeriesText?.overview || tvdbSeries.overview,
    runtime: tvdbSeries.averageRuntime > 0 ? tvdbSeries.averageRuntime : undefined,
    thumbs: thumbs.length > 0 ? thumbs : undefined,
    namedSeasons: namedSeasons.length > 0 ? namedSeasons : undefined,
    fanartThumbs: fanartThumb ? [fanartThumb] : undefined,
    episodeguide: JSON.stringify({ tvdb: String(tvdbSeries.id) }),
    tvdbid: String(tvdbSeries.id),
    uniqueIds: [{ default: true, type: "tvdb", value: String(tvdbSeries.id) }],
    premiered: tvdbSeries.firstAired,
    status: tvdbSeries.status?.name,
    watched: false,
    playcount: 0,
    countries: tvdbSeries.originalCountry ? [tvdbSeries.originalCountry] : undefined,
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

export function buildTvShowEpisodeNfoByTVDB(
  tvdbSeries: TvdbSeriesDetails,
  _tvdbSeason: TvdbSeasonDetails,
  tvdbEpisode: TvdbEpisodeDetails,
  episodeTranslationData?: Record<string, string>,
): EpisodeNfo {
  const translatedTitle =
    typeof episodeTranslationData?.name === "string" && episodeTranslationData.name.trim().length > 0
      ? episodeTranslationData.name
      : tvdbEpisode.name;
  const translatedOverview =
    typeof episodeTranslationData?.overview === "string" &&
    episodeTranslationData.overview.trim().length > 0
      ? episodeTranslationData.overview
      : tvdbEpisode.overview;

  return {
    id: String(tvdbEpisode.id),
    title: translatedTitle ?? undefined,
    showTitle: tvdbSeries.name,
    season: tvdbEpisode.seasonNumber,
    episode: tvdbEpisode.number,
    uniqueIds: [{ default: true, type: "tvdb", value: String(tvdbEpisode.id) }],
    plot: translatedOverview ?? undefined,
    runtime: tvdbEpisode.runtime ?? undefined,
    thumb: tvdbEpisode.image,
    aired: tvdbEpisode.aired ?? undefined,
    watched: false,
    playcount: 0,
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

export function buildMovieNfoByTVDB(
  tvdbMovie: TVDBv4MovieBaseRecord | Record<string, unknown>,
  resolvedMovieText?: { title?: string; overview?: string },
): MovieNFO {
  const data = tvdbMovie as Record<string, unknown>;
  const title = resolvedMovieText?.title || tvdbGetString(data, "name");
  const overview = resolvedMovieText?.overview || tvdbGetString(data, "overview");
  const image = tvdbGetString(data, "image");
  const score = tvdbGetNumber(data, "score");
  const yearText = tvdbGetString(data, "year");
  const year = yearText ? Number.parseInt(yearText, 10) || undefined : undefined;
  const releaseDate = tvdbGetString(data, "releaseDate") ?? tvdbGetString(data, "first_release");
  const runtime = tvdbGetNumber(data, "runtime");
  const statusText =
    typeof data.status === "object" && data.status !== null
      ? tvdbGetString(data.status as Record<string, unknown>, "name")
      : undefined;
  const id = data.id;

  return {
    title,
    originalTitle: title,
    year,
    ratings:
      score && score > 0 ? [{ default: true, max: 10, name: "tvdb", value: score }] : undefined,
    userRating: 0,
    top250: 0,
    plot: overview,
    outline: overview,
    runtime: runtime && runtime > 0 ? runtime : undefined,
    thumbs: image ? [{ url: image, aspect: "poster" }] : undefined,
    id: id !== undefined ? String(id) : "",
    tvdbid: id !== undefined ? String(id) : undefined,
    uniqueIds:
      id !== undefined ? [{ default: true, type: "tvdb", value: String(id) }] : undefined,
    status: statusText,
    premiered: releaseDate,
    watched: false,
    playcount: 0,
    dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}
