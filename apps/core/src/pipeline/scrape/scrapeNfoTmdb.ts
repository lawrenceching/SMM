import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/core";
import { buildTvShowEpisodeNfo, buildTvShowNfo } from "./buildTvShowNfoTmdb";
import {
  convertTvShowEpisodeNfoToXml,
  convertTvShowNfoToXml,
} from "./nfoXml";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import { newFilePathWithExt, parseTmdbSeriesId, scrapeErrorMessage } from "./scrapeTaskDeps";
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

/** Write `tvshow.nfo` and per-episode NFO files from TMDB metadata. */
export async function scrapeNfoTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, tmdb, mediaMetadata, language } = deps;
  const folderPath = mediaMetadata.mediaFolderPath;
  const seriesId = parseTmdbSeriesId(mediaMetadata);

  if (!folderPath) {
    return { status: "failed", error: "Missing media folder path" };
  }
  if (seriesId === undefined) {
    return { status: "failed", error: "TV show TMDB metadata is required" };
  }

  try {
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
      const tvShowNfo = buildTvShowNfo(series, seasons);
      await fs.writeTextFile(tvShowNfoPath, convertTvShowNfoToXml(tvShowNfo));
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

      const episodeNfo = buildTvShowEpisodeNfo(series, tmdbSeason, tmdbEpisode);
      await fs.writeTextFile(episodeNfoPath, convertTvShowEpisodeNfoToXml(episodeNfo));
      wroteAny = true;
    }

    if (wroteAny) {
      return { status: "completed" };
    }
    if (skippedAny) {
      return { status: "skipped" };
    }
    return { status: "failed", error: "No linked episodes to write NFO files for" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
