import type { PreferMediaLanguage, TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/core";
import { mapToTvdbLangCode } from "../../clients/TvdbClient";
import { buildMovieNfoTmdb } from "./buildMovieNfoTmdb";
import {
  buildMovieNfoByTVDB,
  buildTvShowEpisodeNfoByTVDB,
  buildTvShowNfoByTVDB,
} from "./buildNfoTvdb";
import { buildTvShowEpisodeNfo, buildTvShowNfo } from "./buildTvShowNfoTmdb";
import {
  convertMovieNfoToXml,
  convertTvShowEpisodeNfoToXml,
  convertTvShowNfoToXml,
} from "./nfoXml";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import {
  newFilePathWithExt,
  parseNumericMediaId,
  parseTmdbSeriesId,
  scrapeErrorMessage,
} from "./scrapeTaskDeps";
import type { ScrapeTaskResult } from "./types";
import { joinPosix } from "../paths";

async function fetchTvShowSeasons(
  seriesId: number,
  language: string,
  getTvShowById: (id: number, language: string) => Promise<TmdbSeriesDetails>,
  getTvSeasonById: (
    seriesId: number,
    seasonNumber: number,
    language: string,
  ) => Promise<TmdbSeasonDetails>,
): Promise<{ series: TmdbSeriesDetails; seasons: TmdbSeasonDetails[] }> {
  const series = await getTvShowById(seriesId, language);
  const seasons = await Promise.all(
    (series.seasons ?? []).map((season) =>
      getTvSeasonById(seriesId, season.season_number, language),
    ),
  );
  return { series, seasons };
}

function toPreferMediaLanguage(language: string): PreferMediaLanguage {
  if (language === "zh-CN" || language === "ja-JP" || language === "en-US") {
    return language;
  }
  return "en-US";
}

async function scrapeTvShowNfoTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, tmdb, mediaMetadata, language } = deps;
  const folderPath = mediaMetadata.mediaFolderPath!;
  const seriesId = parseTmdbSeriesId(mediaMetadata);
  if (seriesId === undefined) {
    return { status: "failed", error: "TV show TMDB metadata is required" };
  }

  const { series, seasons } = await fetchTvShowSeasons(
    seriesId,
    language,
    (id, lang) => tmdb.getTvShowById(id, lang),
    (id, season, lang) => tmdb.getTvSeasonById(id, season, lang),
  );

  let wroteAny = false;
  let skippedAny = false;

  const tvShowNfoPath = joinPosix(folderPath, "tvshow.nfo");
  if (await fs.exists(tvShowNfoPath)) {
    skippedAny = true;
  } else {
    await fs.writeTextFile(tvShowNfoPath, convertTvShowNfoToXml(buildTvShowNfo(series, seasons)));
    wroteAny = true;
  }

  for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
    const { seasonNumber, episodeNumber, absolutePath } = mediaFile;
    if (seasonNumber === undefined || episodeNumber === undefined) continue;

    const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo");
    if (await fs.exists(episodeNfoPath)) {
      skippedAny = true;
      continue;
    }

    const tmdbSeason = seasons.find((season) => season.season_number === seasonNumber);
    const tmdbEpisode = tmdbSeason?.episodes?.find(
      (episode) => episode.episode_number === episodeNumber,
    );
    if (!tmdbSeason || !tmdbEpisode) continue;

    await fs.writeTextFile(
      episodeNfoPath,
      convertTvShowEpisodeNfoToXml(buildTvShowEpisodeNfo(series, tmdbSeason, tmdbEpisode)),
    );
    wroteAny = true;
  }

  if (wroteAny) return { status: "completed" };
  if (skippedAny) return { status: "skipped" };
  return { status: "failed", error: "No linked episodes to write NFO files for" };
}

async function scrapeTvShowNfoTvdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, tvdb, mediaMetadata, language } = deps;
  const folderPath = mediaMetadata.mediaFolderPath!;
  const seriesId = parseNumericMediaId(mediaMetadata.tvShow?.id);
  if (seriesId === undefined) {
    return { status: "failed", error: "TV show TVDB metadata is required" };
  }

  const langCode = mapToTvdbLangCode(toPreferMediaLanguage(language));
  const series = await tvdb.getSeriesExtended(seriesId);
  if (!series) {
    return { status: "failed", error: `Failed to fetch TVDB series: ${seriesId}` };
  }

  const seasons = (
    await Promise.all((series.seasons ?? []).map((s) => tvdb.getSeasonExtended(s.id)))
  ).filter((s): s is NonNullable<typeof s> => s !== undefined);

  const seriesTranslation = await tvdb.getSeriesTranslation(seriesId, langCode);
  const resolvedSeriesText = {
    title:
      typeof seriesTranslation?.name === "string" && seriesTranslation.name.trim().length > 0
        ? seriesTranslation.name
        : series.name,
    overview:
      typeof seriesTranslation?.overview === "string" &&
      seriesTranslation.overview.trim().length > 0
        ? seriesTranslation.overview
        : series.overview,
  };

  let wroteAny = false;
  let skippedAny = false;

  const tvShowNfoPath = joinPosix(folderPath, "tvshow.nfo");
  if (await fs.exists(tvShowNfoPath)) {
    skippedAny = true;
  } else {
    await fs.writeTextFile(
      tvShowNfoPath,
      convertTvShowNfoToXml(buildTvShowNfoByTVDB(series, seasons, resolvedSeriesText)),
    );
    wroteAny = true;
  }

  for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
    const { seasonNumber, episodeNumber, absolutePath } = mediaFile;
    if (seasonNumber === undefined || episodeNumber === undefined) continue;

    const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo");
    if (await fs.exists(episodeNfoPath)) {
      skippedAny = true;
      continue;
    }

    const tvdbSeason = seasons.find((s) =>
      (s.episodes ?? []).some((e) => e.seasonNumber === Number(seasonNumber)),
    );
    const tvdbEpisode = tvdbSeason?.episodes?.find((e) => e.number === Number(episodeNumber));
    if (!tvdbSeason || !tvdbEpisode) continue;

    let episodeTranslation: Record<string, string> | undefined;
    try {
      episodeTranslation = await tvdb.getEpisodeTranslation(tvdbEpisode.id, langCode);
    } catch {
      /* optional */
    }

    await fs.writeTextFile(
      episodeNfoPath,
      convertTvShowEpisodeNfoToXml(
        buildTvShowEpisodeNfoByTVDB(series, tvdbSeason, tvdbEpisode, episodeTranslation),
      ),
    );
    wroteAny = true;
  }

  if (wroteAny) return { status: "completed" };
  if (skippedAny) return { status: "skipped" };
  return { status: "failed", error: "No linked episodes to write NFO files for" };
}

async function scrapeMovieNfoTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, tmdb, mediaMetadata, language } = deps;
  const folderPath = mediaMetadata.mediaFolderPath!;
  const movieId = parseNumericMediaId(mediaMetadata.movie?.id);
  if (movieId === undefined) {
    return { status: "failed", error: "Movie TMDB metadata is required" };
  }

  const movieNfoPath = joinPosix(folderPath, "movie.nfo");
  if (await fs.exists(movieNfoPath)) {
    return { status: "skipped" };
  }

  const details = await tmdb.getMovieById(movieId, language);
  await fs.writeTextFile(movieNfoPath, convertMovieNfoToXml(buildMovieNfoTmdb(details)));
  return { status: "completed" };
}

async function scrapeMovieNfoTvdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, tvdb, mediaMetadata, language } = deps;
  const folderPath = mediaMetadata.mediaFolderPath!;
  const movieId = parseNumericMediaId(mediaMetadata.movie?.id);
  if (movieId === undefined) {
    return { status: "failed", error: "Movie TVDB metadata is required" };
  }

  const movieNfoPath = joinPosix(folderPath, "movie.nfo");
  if (await fs.exists(movieNfoPath)) {
    return { status: "skipped" };
  }

  const record = await tvdb.getMovieExtended(movieId);
  if (!record) {
    return { status: "failed", error: `Failed to fetch TVDB movie: ${movieId}` };
  }

  const langCode = mapToTvdbLangCode(toPreferMediaLanguage(language));
  let resolvedMovieText: { title?: string; overview?: string } | undefined;
  try {
    const translation = await tvdb.getMovieTranslation(movieId, langCode);
    if (translation) {
      resolvedMovieText = {
        title:
          typeof translation.name === "string" && translation.name.trim().length > 0
            ? translation.name
            : undefined,
        overview:
          typeof translation.overview === "string" && translation.overview.trim().length > 0
            ? translation.overview
            : undefined,
      };
    }
  } catch {
    /* optional */
  }

  await fs.writeTextFile(
    movieNfoPath,
    convertMovieNfoToXml(buildMovieNfoByTVDB(record, resolvedMovieText)),
  );
  return { status: "completed" };
}

/** Write NFO files for TV|movie × TMDB|TVDB. */
export async function scrapeNfoTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { mediaMetadata } = deps;
  if (!mediaMetadata.mediaFolderPath) {
    return { status: "failed", error: "Missing media folder path" };
  }

  try {
    if (mediaMetadata.type === "tvshow-folder") {
      if (mediaMetadata.tvShow?.database === "TMDB") return scrapeTvShowNfoTmdb(deps);
      if (mediaMetadata.tvShow?.database === "TVDB") return scrapeTvShowNfoTvdb(deps);
      return { status: "failed", error: "Unsupported TV database for NFO" };
    }
    if (mediaMetadata.type === "movie-folder") {
      if (mediaMetadata.movie?.database === "TMDB") return scrapeMovieNfoTmdb(deps);
      if (mediaMetadata.movie?.database === "TVDB") return scrapeMovieNfoTvdb(deps);
      return { status: "failed", error: "Unsupported movie database for NFO" };
    }
    return { status: "failed", error: "Unsupported folder type for NFO" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
