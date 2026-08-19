import type { TmdbSeriesDetails } from "@smm/core";
import { downloadScrapeImage } from "./downloadScrapeImage";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import {
  fileExtensionFromUrl,
  parseTmdbSeriesId,
  scrapeErrorMessage,
} from "./scrapeTaskDeps";
import { getTmdbImageUrl } from "./tmdbImageUrl";
import type { ScrapeTaskResult } from "./types";
import { joinPosix } from "../paths";

export async function resolvePosterUrl(
  seriesId: number,
  language: string,
  getTvShowById: (id: number, language: string) => Promise<TmdbSeriesDetails>,
): Promise<string | undefined> {
  const series = await getTvShowById(seriesId, language);
  return getTmdbImageUrl(series.poster_path, "original") ?? undefined;
}

/** Download TMDB TV poster as `poster.{ext}` in the media folder root. */
export async function scrapePosterTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, network, tmdb, mediaMetadata, language, userConfig } = deps;
  const folderPath = mediaMetadata.mediaFolderPath;
  const seriesId = parseTmdbSeriesId(mediaMetadata);

  if (!folderPath) {
    return { status: "failed", error: "Missing media folder path" };
  }
  if (seriesId === undefined) {
    return { status: "failed", error: "TV show TMDB metadata is required" };
  }

  try {
    const posterUrl = await resolvePosterUrl(seriesId, language, (id, lang) =>
      tmdb.getTvShowById(id, lang),
    );
    if (!posterUrl) {
      return { status: "failed", error: "No TMDB poster available" };
    }

    const ext = fileExtensionFromUrl(posterUrl);
    const posterPath = joinPosix(folderPath, `poster.${ext}`);

    if (await fs.exists(posterPath)) {
      return { status: "skipped" };
    }

    await downloadScrapeImage(
      mediaMetadata,
      posterUrl,
      posterPath,
      userConfig,
      fs,
      network,
    );
    return { status: "completed" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
