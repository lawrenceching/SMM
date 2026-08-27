import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/core";
import { downloadScrapeImage } from "./downloadScrapeImage";
import { extname } from "../paths";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import {
  newFilePathWithExt,
  parseNumericMediaId,
  parseTmdbSeriesId,
  scrapeErrorMessage,
} from "./scrapeTaskDeps";
import { getTmdbImageUrl } from "./tmdbImageUrl";
import type { ScrapeTaskResult } from "./types";

export interface EpisodeStillPath {
  season: number;
  episode: number;
  stillUrl: string;
}

export async function getEpisodeStillPathsFromTmdb(
  seriesId: number,
  language: string,
  getTvShowById: (id: number, language: string) => Promise<TmdbSeriesDetails>,
  getTvSeasonById: (
    seriesId: number,
    seasonNumber: number,
    language: string,
  ) => Promise<TmdbSeasonDetails>,
): Promise<EpisodeStillPath[]> {
  const tvshow = await getTvShowById(seriesId, language);
  const stillPaths: EpisodeStillPath[] = [];

  for (const season of tvshow.seasons ?? []) {
    const tmdbSeason = await getTvSeasonById(seriesId, season.season_number, language);
    for (const episode of tmdbSeason.episodes ?? []) {
      if (!episode.still_path) continue;
      const stillUrl = getTmdbImageUrl(episode.still_path, "original");
      if (!stillUrl) continue;
      stillPaths.push({
        season: season.season_number,
        episode: episode.episode_number,
        stillUrl,
      });
    }
  }

  return stillPaths;
}

async function getEpisodeStillPathsFromTvdb(
  seriesId: number,
  tvdb: ScrapeTaskDeps["tvdb"],
): Promise<EpisodeStillPath[]> {
  const artworkTypes = await tvdb.getArtworkTypes();
  const screencapTypeId = artworkTypes?.find((type) => type.name === "16:9 Screencap")?.id ?? 11;
  const series = await tvdb.getSeriesExtended(seriesId);
  const stillPaths: EpisodeStillPath[] = [];

  for (const season of series?.seasons ?? []) {
    const tvdbSeason = await tvdb.getSeasonExtended(season.id);
    for (const episode of tvdbSeason?.episodes ?? []) {
      if (episode.image === undefined) continue;
      if (episode.imageType !== screencapTypeId) continue;
      stillPaths.push({
        season: season.number,
        episode: episode.number,
        stillUrl: episode.image,
      });
    }
  }

  return stillPaths;
}

async function downloadStills(
  deps: ScrapeTaskDeps,
  stillPaths: EpisodeStillPath[],
): Promise<ScrapeTaskResult> {
  const { fs, network, mediaMetadata, userConfig } = deps;
  const mediaFiles = (mediaMetadata.mediaFiles ?? []).filter(
    (file) => file.seasonNumber !== undefined && file.episodeNumber !== undefined,
  );

  let downloaded = 0;
  let skipped = 0;

  for (const mediaFile of mediaFiles) {
    const still = stillPaths.find(
      (path) =>
        path.season === mediaFile.seasonNumber && path.episode === mediaFile.episodeNumber,
    );
    if (!still) continue;

    const thumbPath = newFilePathWithExt(mediaFile.absolutePath, extname(still.stillUrl));
    if (await fs.exists(thumbPath)) {
      skipped += 1;
      continue;
    }

    await downloadScrapeImage(
      mediaMetadata,
      still.stillUrl,
      thumbPath,
      userConfig,
      fs,
      network,
      { discover: deps.discover, hostPerformance: deps.hostPerformance },
    );
    downloaded += 1;
  }

  if (downloaded > 0) return { status: "completed" };
  if (skipped > 0) return { status: "skipped" };
  return { status: "failed", error: "No episode stills available for linked files" };
}

/** Download episode stills (TV) or skip (movie — legacy UI TODO). */
export async function scrapeThumbnailsTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { tmdb, tvdb, mediaMetadata, language } = deps;

  if (mediaMetadata.type === "movie-folder") {
    return { status: "skipped" };
  }

  if (mediaMetadata.type !== "tvshow-folder") {
    return { status: "failed", error: "Unsupported folder type for thumbnails" };
  }

  const mediaFiles = (mediaMetadata.mediaFiles ?? []).filter(
    (file) => file.seasonNumber !== undefined && file.episodeNumber !== undefined,
  );
  if (mediaFiles.length === 0) {
    return { status: "skipped" };
  }

  try {
    if (mediaMetadata.tvShow?.database === "TMDB") {
      const seriesId = parseTmdbSeriesId(mediaMetadata);
      if (seriesId === undefined) {
        return { status: "failed", error: "TV show TMDB metadata is required" };
      }
      const stillPaths = await getEpisodeStillPathsFromTmdb(
        seriesId,
        language,
        (id, lang) => tmdb.getTvShowById(id, lang),
        (id, season, lang) => tmdb.getTvSeasonById(id, season, lang),
      );
      return downloadStills(deps, stillPaths);
    }

    if (mediaMetadata.tvShow?.database === "TVDB") {
      const seriesId = parseNumericMediaId(mediaMetadata.tvShow.id);
      if (seriesId === undefined) {
        return { status: "failed", error: "TV show TVDB metadata is required" };
      }
      const stillPaths = await getEpisodeStillPathsFromTvdb(seriesId, tvdb);
      return downloadStills(deps, stillPaths);
    }

    return { status: "failed", error: "Unsupported TV database for thumbnails" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
