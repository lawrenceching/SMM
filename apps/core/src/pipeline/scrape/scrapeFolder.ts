import { Path } from "@smm/utils/path";
import type { MediaMetadata } from "@smm/types";
import { TmdbClient } from "../../clients/TmdbClient";
import { TvdbClient } from "../../clients/TvdbClient";
import type { AppContext, PlatformPorts } from "../../types";
import { metadataCachePath } from "../paths";
import { UserConfigHelper } from "../userConfigHelper";
import type { UserConfig as UserConfigData } from "@smm/types";
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
  context: AppContext,
  ports: PlatformPorts,
): Promise<PreparedScrape> {
  const posixPath = ports.normalizePosix(path);
  const userConfig = new UserConfigHelper(ports.fs, context.userDataDir);

  const config = await userConfig.read();
  if (!isManaged(config.folders ?? [], path)) {
    throw new Error(`${posixPath} is not managed by SMM`);
  }

  const cachePath = metadataCachePath(context.appDataDir, posixPath);
  if (!(await ports.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${path}`);
  }

  let mediaMetadata: MediaMetadata;
  try {
    mediaMetadata = JSON.parse(await ports.fs.readTextFile(cachePath)) as MediaMetadata;
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
  context: AppContext,
  ports: PlatformPorts,
  progress?: ScrapeFolderProgress,
): Promise<ScrapeFolderResult> {
  const prepared = await prepareScrapeFolder(path, options, context, ports);
  return runPreparedScrape(prepared, context, ports, progress);
}

export async function runPreparedScrape(
  prepared: PreparedScrape,
  context: AppContext,
  ports: PlatformPorts,
  progress?: ScrapeFolderProgress,
): Promise<ScrapeFolderResult> {
  const { posixPath, language, config, mediaMetadata } = prepared;

  const tmdb = new TmdbClient(ports.network, {
    ...config.tmdb,
    discover: ports.discover,
    reverseProxyUrl: context.reverseProxyUrl,
    hostPerformance: ports.hostPerformance,
  });
  const tvdb = new TvdbClient(ports.network, {
    ...config.tvdb,
    discover: ports.discover,
    reverseProxyUrl: context.reverseProxyUrl,
    hostPerformance: ports.hostPerformance,
  });

  const completion = await checkScrapeCompletion(mediaMetadata, ports.fs);

  const taskDeps: ScrapeTaskDeps = {
    fs: ports.fs,
    network: ports.network,
    tmdb,
    tvdb,
    mediaMetadata,
    language,
    userConfig: config,
    reverseProxyUrl: context.reverseProxyUrl ?? undefined,
    discover: ports.discover,
    hostPerformance: ports.hostPerformance,
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
