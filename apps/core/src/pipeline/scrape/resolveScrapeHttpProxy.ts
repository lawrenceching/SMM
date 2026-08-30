import { isEmpty } from "es-toolkit/compat";
import type { MediaMetadata, UserConfig } from "@smm/types";

/**
 * Resolve the outbound HTTP proxy for a media database. Mirrors the rule in
 * UI `fetchTmdb` / `fetchTvdb`: the proxy only applies when the user configured
 * a custom host (non-empty, parseable) AND set an httpProxy.
 */
export function resolveMediaDatabaseHttpProxy(
  database: "TMDB" | "TVDB",
  userConfig: UserConfig,
): string | undefined {
  const cfg = database === "TMDB" ? userConfig.tmdb : userConfig.tvdb;
  if (!cfg) return undefined;
  if (isEmpty(cfg.host)) return undefined;
  if (!URL.canParse(cfg.host!)) return undefined;
  const proxy = cfg.httpProxy?.trim();
  return proxy || undefined;
}

/**
 * Resolve the proxy for a scrape task from the media metadata's database.
 */
export function resolveScrapeHttpProxy(
  mediaMetadata: MediaMetadata,
  userConfig: UserConfig,
): string | undefined {
  const database =
    mediaMetadata.type === "tvshow-folder"
      ? mediaMetadata.tvShow?.database
      : mediaMetadata.type === "movie-folder"
        ? mediaMetadata.movie?.database
        : undefined;
  if (!database) return undefined;
  return resolveMediaDatabaseHttpProxy(database, userConfig);
}
