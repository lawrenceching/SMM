import type { MediaMetadata, UserConfig } from "@smm/types";
import type { TmdbClient } from "../../clients/TmdbClient";
import type { TvdbClient } from "../../clients/TvdbClient";
import type { HostPerformanceStore } from "../../clients/hostPerformance";
import type { DiscoverPort } from "../../ports/DiscoverPort";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { extname } from "../paths";

export interface ScrapeTaskDeps {
  fs: FsPort;
  network: NetworkPort;
  tmdb: TmdbClient;
  tvdb: TvdbClient;
  mediaMetadata: MediaMetadata;
  language: string;
  userConfig: UserConfig;
  reverseProxyUrl?: string;
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
}

export function fileExtensionFromUrl(url: string): string {
  const matched = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#].*)?$/);
  return matched?.[1]?.toLowerCase() || "jpg";
}

export function newFilePathWithExt(filePath: string, newExt: string): string {
  const normalizedExt = newExt.startsWith(".") ? newExt : `.${newExt}`;
  const currentExt = extname(filePath);
  const base = currentExt ? filePath.slice(0, -currentExt.length) : filePath;
  return `${base}${normalizedExt}`;
}

export function parseTmdbSeriesId(mediaMetadata: MediaMetadata): number | undefined {
  if (mediaMetadata.type !== "tvshow-folder" || mediaMetadata.tvShow?.database !== "TMDB") {
    return undefined;
  }
  const id = Number.parseInt(mediaMetadata.tvShow.id, 10);
  return Number.isFinite(id) ? id : undefined;
}

export function parseNumericMediaId(id: string | undefined): number | undefined {
  if (id === undefined) return undefined;
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function scrapeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
