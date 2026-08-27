import { Path } from "@core/path";
import type { MediaMetadata } from "@smm/core";
import { TmdbClient } from "../../clients/TmdbClient";
import { TvdbClient } from "../../clients/TvdbClient";
import type { DiscoverPort } from "../../ports/DiscoverPort";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { metadataCachePath } from "../paths";
import type { UserConfigHelper } from "../userConfigHelper";
import type { UserConfig as UserConfigData } from "@smm/core";
import { checkScrapeCompletion } from "./checkScrapeCompletion";
import { scrapeFanartTmdb } from "./scrapeFanartTmdb";
import { scrapeNfoTmdb } from "./scrapeNfoTmdb";
import { scrapePosterTmdb } from "./scrapePosterTmdb";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import { scrapeThumbnailsTmdb } from "./scrapeThumbnailsTmdb";
import type { ScrapeFolderResult, ScrapeTaskId, ScrapeTaskResult } from "./types";

export interface ScrapeFolderOptions {
  /** Defaults to userConfig.preferMediaLanguage */
  language?: string;
}

export interface ScrapeFolderDeps {
  fs: FsPort;
  network: NetworkPort;
  appDataDir: string;
  userConfig: UserConfigHelper;
  normalizePosix: (path: string) => string;
  discover?: DiscoverPort;
  reverseProxyUrl?: string | null;
}

export interface ScrapeFolderProgress {
  onTaskStart?: (taskId: ScrapeTaskId) => void;
  onTaskDone?: (taskId: ScrapeTaskId, result: ScrapeTaskResult) => void;
}

const TASK_ORDER: ScrapeTaskId[] = ["poster", "fanart", "thumbnails", "nfo"];

const TASK_RUNNERS: Record<
  ScrapeTaskId,
  (deps: ScrapeTaskDeps) => Promise<ScrapeTaskResult>
> = {
  poster: scrapePosterTmdb,
  fanart: scrapeFanartTmdb,
  thumbnails: scrapeThumbnailsTmdb,
  nfo: scrapeNfoTmdb,
};

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

export interface PreparedScrape {
  posixPath: string;
  language: string;
  config: UserConfigData;
  mediaMetadata: MediaMetadata;
}

/** Throws if the folder cannot be scraped (no side effects beyond reads). */
export async function prepareScrapeFolder(
  path: string,
  options: ScrapeFolderOptions | undefined,
  deps: ScrapeFolderDeps,
): Promise<PreparedScrape> {
  const posixPath = deps.normalizePosix(path);

  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], path)) {
    throw new Error(`${posixPath} is not managed by SMM`);
  }

  const cachePath = metadataCachePath(deps.appDataDir, posixPath);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${path}`);
  }

  let mediaMetadata: MediaMetadata;
  try {
    mediaMetadata = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
    throw new Error(`Media metadata not found: ${path}`);
  }

  if (mediaMetadata.type === "tvshow-folder") {
    const database = mediaMetadata.tvShow?.database;
    if (database !== "TMDB" && database !== "TVDB") {
      throw new Error(`Unsupported media database: ${database ?? "unknown"}`);
    }
  } else if (mediaMetadata.type === "movie-folder") {
    const database = mediaMetadata.movie?.database;
    if (database !== "TMDB" && database !== "TVDB") {
      throw new Error(`Unsupported media database: ${database ?? "unknown"}`);
    }
  } else {
    throw new Error(`Folder is not a TV show or movie: ${path}`);
  }

  const language = options?.language ?? config.preferMediaLanguage ?? "en-US";

  return {
    posixPath,
    language,
    config,
    mediaMetadata: { ...mediaMetadata, mediaFolderPath: posixPath },
  };
}

/** Run TMDB TV scrape tasks sequentially; skip at orchestrator when artifacts exist. */
export async function scrapeFolderPipeline(
  path: string,
  options: ScrapeFolderOptions | undefined,
  deps: ScrapeFolderDeps,
  progress?: ScrapeFolderProgress,
): Promise<ScrapeFolderResult> {
  const prepared = await prepareScrapeFolder(path, options, deps);
  return runPreparedScrape(prepared, deps, progress);
}

export async function runPreparedScrape(
  prepared: PreparedScrape,
  deps: ScrapeFolderDeps,
  progress?: ScrapeFolderProgress,
): Promise<ScrapeFolderResult> {
  const { posixPath, language, config, mediaMetadata } = prepared;

  const tmdb = new TmdbClient(deps.network, {
    ...config.tmdb,
    discover: deps.discover,
    reverseProxyUrl: deps.reverseProxyUrl,
  });
  const tvdb = new TvdbClient(deps.network, {
    ...config.tvdb,
    discover: deps.discover,
    reverseProxyUrl: deps.reverseProxyUrl,
  });

  const completion = await checkScrapeCompletion(mediaMetadata, deps.fs);

  const taskDeps: ScrapeTaskDeps = {
    fs: deps.fs,
    network: deps.network,
    tmdb,
    tvdb,
    mediaMetadata,
    language,
    userConfig: config,
    reverseProxyUrl: deps.reverseProxyUrl ?? undefined,
    discover: deps.discover,
  };

  const tasks = {} as Record<ScrapeTaskId, ScrapeTaskResult>;

  for (const taskId of TASK_ORDER) {
    if (completion[taskId]) {
      const skipped: ScrapeTaskResult = { status: "skipped" };
      tasks[taskId] = skipped;
      progress?.onTaskDone?.(taskId, skipped);
      continue;
    }
    progress?.onTaskStart?.(taskId);
    const result = await TASK_RUNNERS[taskId](taskDeps);
    tasks[taskId] = result;
    progress?.onTaskDone?.(taskId, result);
  }

  return {
    mediaFolderPath: posixPath,
    tasks,
  };
}
