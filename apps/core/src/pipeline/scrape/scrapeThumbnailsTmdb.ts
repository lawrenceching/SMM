import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/core";
import { downloadScrapeImage } from "./downloadScrapeImage";
import { extname } from "../paths";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import {
  newFilePathWithExt,
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

/** Download TMDB episode stills beside each linked video file. */
export async function scrapeThumbnailsTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, network, tmdb, mediaMetadata, language, userConfig } = deps;
  const seriesId = parseTmdbSeriesId(mediaMetadata);

  if (seriesId === undefined) {
    return { status: "failed", error: "TV show TMDB metadata is required" };
  }

  const mediaFiles = (mediaMetadata.mediaFiles ?? []).filter(
    (file) => file.seasonNumber !== undefined && file.episodeNumber !== undefined,
  );
  if (mediaFiles.length === 0) {
    return { status: "skipped" };
  }

  try {
    const stillPaths = await getEpisodeStillPathsFromTmdb(
      seriesId,
      language,
      (id, lang) => tmdb.getTvShowById(id, lang),
      (id, season, lang) => tmdb.getTvSeasonById(id, season, lang),
    );

    let downloaded = 0;
    let skipped = 0;

    for (const mediaFile of mediaFiles) {
      const still = stillPaths.find(
        (path) =>
          path.season === mediaFile.seasonNumber &&
          path.episode === mediaFile.episodeNumber,
      );
      if (!still) continue;

      const thumbPath = newFilePathWithExt(
        mediaFile.absolutePath,
        extname(still.stillUrl),
      );

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
      );
      downloaded += 1;
    }

    if (downloaded > 0) {
      return { status: "completed" };
    }
    if (skipped > 0) {
      return { status: "skipped" };
    }
    return { status: "failed", error: "No TMDB episode stills available for linked files" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
