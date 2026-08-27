import type { MediaMetadata } from "@smm/core";
import type { TVDBv4Artwork, TVDBv4SeriesExtendedResponse } from "@smm/tvdb4/types";
import { downloadScrapeImage } from "./downloadScrapeImage";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import {
  fileExtensionFromUrl,
  parseNumericMediaId,
  scrapeErrorMessage,
} from "./scrapeTaskDeps";
import { getTmdbImageUrl } from "./tmdbImageUrl";
import type { ScrapeTaskResult } from "./types";
import { joinPosix } from "../paths";

function toImageUrl(record: unknown): string | undefined {
  return typeof record === "string" && record.trim().length > 0 ? record : undefined;
}

function parseTvdbArtworks(record: unknown): TVDBv4Artwork[] {
  if (!Array.isArray(record)) return [];
  return record.filter((item): item is TVDBv4Artwork => {
    if (typeof item !== "object" || item === null) return false;
    const image = (item as { image?: unknown }).image;
    return typeof image === "string" && image.length > 0;
  });
}

function pickBestArtworkImage(artworks: TVDBv4Artwork[]): string | undefined {
  const sorted = [...artworks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted[0]?.image;
}

export async function resolvePosterUrl(
  mediaMetadata: MediaMetadata,
  language: string,
  deps: Pick<ScrapeTaskDeps, "tmdb" | "tvdb">,
): Promise<string | undefined> {
  if (mediaMetadata.type === "tvshow-folder") {
    const tvShow = mediaMetadata.tvShow;
    const id = parseNumericMediaId(tvShow?.id);
    if (!tvShow || id === undefined) return undefined;

    if (tvShow.database === "TMDB") {
      const series = await deps.tmdb.getTvShowById(id, language);
      return getTmdbImageUrl(series.poster_path, "original") ?? undefined;
    }
    if (tvShow.database === "TVDB") {
      const series = await deps.tvdb.getSeriesExtended(id);
      if (!series) return undefined;
      return toImageUrl(series.image) || pickBestArtworkImage(series.artworks ?? []);
    }
    return undefined;
  }

  if (mediaMetadata.type === "movie-folder") {
    const movie = mediaMetadata.movie;
    const id = parseNumericMediaId(movie?.id);
    if (!movie || id === undefined) return undefined;

    if (movie.database === "TMDB") {
      const details = await deps.tmdb.getMovieById(id, language);
      return getTmdbImageUrl(details.poster_path, "original") ?? undefined;
    }
    if (movie.database === "TVDB") {
      const record = await deps.tvdb.getMovieExtended(id);
      if (!record) return undefined;
      const baseImage = toImageUrl(record.image);
      if (baseImage) return baseImage;
      return pickBestArtworkImage(parseTvdbArtworks(record.artworks));
    }
  }

  return undefined;
}

/** @deprecated Prefer resolvePosterUrl(mediaMetadata, …) — kept for existing TMDB-TV unit tests. */
export async function resolvePosterUrlTmdbTv(
  seriesId: number,
  language: string,
  getTvShowById: ScrapeTaskDeps["tmdb"]["getTvShowById"],
): Promise<string | undefined> {
  const series = await getTvShowById(seriesId, language);
  return getTmdbImageUrl(series.poster_path, "original") ?? undefined;
}

/** Download poster as `poster.{ext}` for TV|movie × TMDB|TVDB. */
export async function scrapePosterTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  return scrapePoster(deps);
}

export async function scrapePoster(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, network, mediaMetadata, language, userConfig } = deps;
  const folderPath = mediaMetadata.mediaFolderPath;

  if (!folderPath) {
    return { status: "failed", error: "Missing media folder path" };
  }

  try {
    const posterUrl = await resolvePosterUrl(mediaMetadata, language, deps);
    if (!posterUrl) {
      return { status: "failed", error: "No poster available" };
    }

    const ext = fileExtensionFromUrl(posterUrl);
    const posterPath = joinPosix(folderPath, `poster.${ext}`);

    if (await fs.exists(posterPath)) {
      return { status: "skipped" };
    }

    await downloadScrapeImage(mediaMetadata, posterUrl, posterPath, userConfig, fs, network, {
      discover: deps.discover,
    });
    return { status: "completed" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}

export type { TVDBv4SeriesExtendedResponse };
