import { Path } from "@core/path";
import type { MediaMetadata } from "@smm/core";
import { TmdbClient } from "../../clients/TmdbClient";
import type { DiscoverPort } from "../../ports/DiscoverPort";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { metadataCachePath } from "../paths";
import type { UserConfig } from "../userConfig";
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
  userConfig: UserConfig;
  normalizePosix: (path: string) => string;
  discover?: DiscoverPort;
  reverseProxyUrl?: string | null;
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

/** Run TMDB TV scrape tasks sequentially; skip at orchestrator when artifacts exist. */
export async function scrapeFolderPipeline(
  path: string,
  options: ScrapeFolderOptions | undefined,
  deps: ScrapeFolderDeps,
): Promise<ScrapeFolderResult> {
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

  if (mediaMetadata.type !== "tvshow-folder") {
    throw new Error(`Folder is not a TV show: ${path}`);
  }
  if (mediaMetadata.tvShow?.database !== "TMDB") {
    throw new Error(`TV show must use TMDB database: ${path}`);
  }

  const language = options?.language ?? config.preferMediaLanguage ?? "en-US";

  const tmdb = new TmdbClient(deps.network, {
    ...config.tmdb,
    discover: deps.discover,
    reverseProxyUrl: deps.reverseProxyUrl,
  });

  const normalizedMetadata: MediaMetadata = {
    ...mediaMetadata,
    mediaFolderPath: posixPath,
  };

  const completion = await checkScrapeCompletion(normalizedMetadata, deps.fs);

  const taskDeps: ScrapeTaskDeps = {
    fs: deps.fs,
    network: deps.network,
    tmdb,
    mediaMetadata: normalizedMetadata,
    language,
    userConfig: config,
    reverseProxyUrl: deps.reverseProxyUrl ?? undefined,
  };

  const tasks = {} as Record<ScrapeTaskId, ScrapeTaskResult>;

  for (const taskId of TASK_ORDER) {
    if (completion[taskId]) {
      tasks[taskId] = { status: "skipped" };
      continue;
    }
    tasks[taskId] = await TASK_RUNNERS[taskId](taskDeps);
  }

  return {
    mediaFolderPath: posixPath,
    tasks,
  };
}
