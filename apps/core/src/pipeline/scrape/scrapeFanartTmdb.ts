import type { MediaMetadata } from "@smm/types";
import type { TVDBv4Artwork, TVDBv4ArtworkTypeRecord } from "@smm/tvdb4/types";
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

function pickBackgroundArtworkImage(
  artworks: TVDBv4Artwork[],
  artworkTypes: TVDBv4ArtworkTypeRecord[] | undefined,
  recordType: "series" | "movie",
): string | undefined {
  if (!artworks.length) return undefined;

  const backgroundTypeIds = (artworkTypes ?? [])
    .filter((type) => type.recordType === recordType && type.name.toLowerCase().includes("background"))
    .map((type) => type.id);
  if (!backgroundTypeIds.length) return undefined;

  const candidates = artworks
    .filter((art) => backgroundTypeIds.includes(art.type))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return candidates[0]?.image;
}

export async function resolveFanartUrl(
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
      return getTmdbImageUrl(series.backdrop_path, "original") ?? undefined;
    }
    if (tvShow.database === "TVDB") {
      const series = await deps.tvdb.getSeriesExtended(id);
      if (!series) return undefined;
      const types = await deps.tvdb.getArtworkTypes();
      return (
        pickBackgroundArtworkImage(series.artworks ?? [], types, "series") ||
        pickBestArtworkImage(series.artworks ?? [])
      );
    }
    return undefined;
  }

  if (mediaMetadata.type === "movie-folder") {
    const movie = mediaMetadata.movie;
    const id = parseNumericMediaId(movie?.id);
    if (!movie || id === undefined) return undefined;

    if (movie.database === "TMDB") {
      const details = await deps.tmdb.getMovieById(id, language);
      return getTmdbImageUrl(details.backdrop_path, "original") ?? undefined;
    }
    if (movie.database === "TVDB") {
      const record = await deps.tvdb.getMovieExtended(id);
      if (!record) return undefined;
      const artworks = parseTvdbArtworks(record.artworks);
      if (!artworks.length) return undefined;
      const types = await deps.tvdb.getArtworkTypes();
      return pickBackgroundArtworkImage(artworks, types, "movie") || pickBestArtworkImage(artworks);
    }
  }

  return undefined;
}

/** @deprecated Prefer resolveFanartUrl(mediaMetadata, …). */
export async function resolveFanartUrlTmdbTv(
  seriesId: number,
  language: string,
  getTvShowById: ScrapeTaskDeps["tmdb"]["getTvShowById"],
): Promise<string | undefined> {
  const series = await getTvShowById(seriesId, language);
  return getTmdbImageUrl(series.backdrop_path, "original") ?? undefined;
}

export async function scrapeFanartTmdb(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  return scrapeFanart(deps);
}

export async function scrapeFanart(deps: ScrapeTaskDeps): Promise<ScrapeTaskResult> {
  const { fs, network, mediaMetadata, language, userConfig } = deps;
  const folderPath = mediaMetadata.mediaFolderPath;

  if (!folderPath) {
    return { status: "failed", error: "Missing media folder path" };
  }

  try {
    const fanartUrl = await resolveFanartUrl(mediaMetadata, language, deps);
    if (!fanartUrl) {
      return { status: "failed", error: "No fanart available" };
    }

    const ext = fileExtensionFromUrl(fanartUrl);
    const fanartPath = joinPosix(folderPath, `fanart.${ext}`);

    if (await fs.exists(fanartPath)) {
      return { status: "skipped" };
    }

    await downloadScrapeImage(mediaMetadata, fanartUrl, fanartPath, userConfig, fs, network, {
      discover: deps.discover,
      hostPerformance: deps.hostPerformance,
    });
    return { status: "completed" };
  } catch (error) {
    return { status: "failed", error: scrapeErrorMessage(error) };
  }
}
