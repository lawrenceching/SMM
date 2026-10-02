import { Path } from "@smm/utils/path";
import type { FolderType, MediaMetadata } from "@smm/types";
import type { JobLogLevel, JobStage } from "../jobs/types";
import type { AppContext, PlatformPorts } from "../types";
import { MediaMetadataHelper } from "./mediaMetadataHelper";
import { UserConfigHelper } from "./userConfigHelper";
import {
  recognizedEpisodeFilesMessage,
  recognizedFolderMessage,
  STARTED_RECOGNIZE_EPISODES,
  STARTED_RECOGNIZE_FOLDER,
} from "../jobs/importFolderLog";
import { createRecognitionDeps } from "./createRecognitionDeps";
import { autoRecognizeFolderPipeline } from "./recognizeFolder";
import { buildEpisodes } from "./recognizeEpisodes";
import { recognizeMediaFilesPipeline } from "./recognizeMediaFiles";

export type { AppContext, PlatformPorts } from "../types";

export type MediaMetadataUpdatedHandler = (folderPath: string) => void;

export interface RecognizeImportedFolderRequest {
  folderPath: string;
  filePaths: string[];
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
  throwIfAborted?: () => void;
  appendLog?: (level: JobLogLevel, message: string) => void | Promise<void>;
}

export interface RecognizeImportedEpisodesRequest {
  folderPath: string;
  filePaths: string[];
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
  throwIfAborted?: () => void;
  appendLog?: (level: JobLogLevel, message: string) => void | Promise<void>;
}

/** @deprecated Prefer {@link AppContext} + {@link PlatformPorts}. */
export interface FolderInitializationDeps extends PlatformPorts, AppContext {
  onMediaMetadataUpdated?: MediaMetadataUpdatedHandler;
}

/** @deprecated Prefer fields on {@link RecognizeImportedFolderRequest}. */
export interface FolderInitializationCallbacks {
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
  throwIfAborted?: () => void;
  appendLog?: (level: JobLogLevel, message: string) => void | Promise<void>;
}

function mediaMetadataType(type: FolderType): MediaMetadata["type"] {
  return type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder";
}

/** Blank metadata written at stage 1, before any recognition runs. */
export function createBlankMediaMetadata(folderPath: string, type: FolderType): MediaMetadata {
  const posixPath = Path.posix(folderPath);
  return {
    mediaFolderPath: posixPath,
    type: mediaMetadataType(type),
    mediaFiles: [],
  };
}

/**
 * Stage 1: register the folder in smm.json and write its blank metadata file.
 * Idempotent: skips smm.json when the folder is already listed, and skips
 * metadata when a cache file already exists.
 * `importFolder` returns to the caller once this stage completed.
 * Builds store helpers from ctx/ports (same pattern as recognition stages).
 */
export async function persistNewFolder(
  folderPath: string,
  type: FolderType,
  ctx: AppContext,
  ports: PlatformPorts,
  onMediaMetadataUpdated?: MediaMetadataUpdatedHandler,
): Promise<MediaMetadata> {
  const userConfig = new UserConfigHelper(ports.fs, ctx.userDataDir);
  const mediaMetadata = new MediaMetadataHelper(ports.fs, ctx.appDataDir, onMediaMetadataUpdated);
  await userConfig.addFolder(folderPath);
  const blank = createBlankMediaMetadata(folderPath, type);
  const created = await mediaMetadata.createIfAbsent(blank);
  if (created) return created;
  return (await mediaMetadata.read(folderPath)) ?? blank;
}

/** Stage 2: recognize the media folder (tvshow / movie). Builds TMDB/TVDB clients from ports. */
export async function recognizeImportedFolder(
  req: RecognizeImportedFolderRequest,
  ctx: AppContext,
  ports: PlatformPorts,
  onMediaMetadataUpdated?: MediaMetadataUpdatedHandler,
): Promise<void> {
  const posixPath = ports.normalizePosix(req.folderPath);
  ports.logger.info({ folderPath: posixPath }, "importFolder: stage=recognizeFolder");
  await req.appendLog?.("info", STARTED_RECOGNIZE_FOLDER);

  const recognitionDeps = await createRecognitionDeps({
    fs: ports.fs,
    network: ports.network,
    appDataDir: ctx.appDataDir,
    userDataDir: ctx.userDataDir,
    normalizePosix: ports.normalizePosix,
    osLocale: ctx.osLocale,
    discover: ports.discover,
    hostPerformance: ports.hostPerformance,
    onMediaMetadataUpdated,
  });
  const result = await autoRecognizeFolderPipeline(req.folderPath, recognitionDeps, req.filePaths);
  const title = result.tvShow?.name ?? result.movie?.name;
  if (title !== undefined) {
    await req.appendLog?.("info", recognizedFolderMessage(title));
  }
  req.onStage?.("recognizeFolder", 60, title !== undefined ? { title } : undefined);
}

/**
 * Stage 3: recognize episode / media files inside the folder.
 * Does not need TMDB/TVDB — only local metadata and filesystem.
 */
export async function recognizeImportedEpisodes(
  req: RecognizeImportedEpisodesRequest,
  ctx: AppContext,
  ports: PlatformPorts,
  onMediaMetadataUpdated?: MediaMetadataUpdatedHandler,
): Promise<void> {
  const posixPath = ports.normalizePosix(req.folderPath);
  const mediaMetadata = new MediaMetadataHelper(ports.fs, ctx.appDataDir, onMediaMetadataUpdated);
  ports.logger.info({ folderPath: posixPath }, "importFolder: stage=recognizeEpisodes");
  await req.appendLog?.("info", STARTED_RECOGNIZE_EPISODES);
  const recognized = await recognizeMediaFilesPipeline(
    req.folderPath,
    { fs: ports.fs, mediaMetadata, normalizePosix: ports.normalizePosix },
    req.filePaths,
  );
  const metadata = await mediaMetadata.read(posixPath);
  const totalEpisodes = metadata === null ? 0 : buildEpisodes(metadata).length;
  const recognizedEpisodes = recognized.filter((file) => file.episode !== undefined).length;
  const unrecognizedEpisodes = Math.max(0, totalEpisodes - recognizedEpisodes);
  await req.appendLog?.(
    "info",
    recognizedEpisodeFilesMessage(recognized.length, unrecognizedEpisodes),
  );
  req.onStage?.("recognizeEpisodes", 90);
}

/**
 * Stages 2 and 3 of folder initialization: recognize the media folder, then
 * recognize its episode video files. Music folders are not recognized.
 */
export async function initializeFolder(
  folderPath: string,
  type: FolderType,
  deps: FolderInitializationDeps,
  cb: FolderInitializationCallbacks = {},
): Promise<void> {
  const { onMediaMetadataUpdated, ...portsAndCtx } = deps;
  const ctx: AppContext = {
    appDataDir: portsAndCtx.appDataDir,
    userDataDir: portsAndCtx.userDataDir,
    osLocale: portsAndCtx.osLocale,
  };
  const ports: PlatformPorts = {
    fs: portsAndCtx.fs,
    network: portsAndCtx.network,
    logger: portsAndCtx.logger,
    normalizePosix: portsAndCtx.normalizePosix,
    discover: portsAndCtx.discover,
    hostPerformance: portsAndCtx.hostPerformance,
  };

  const posixPath = ports.normalizePosix(folderPath);
  // Listing once up front feeds both stages and fails initialization of an unreadable folder.
  cb.throwIfAborted?.();
  const filePaths = (await ports.fs.listFiles(posixPath)).map((file) => Path.posix(file));
  if (type !== "tvshow" && type !== "movie") return;

  const reqBase = {
    folderPath,
    filePaths,
    onStage: cb.onStage,
    throwIfAborted: cb.throwIfAborted,
    appendLog: cb.appendLog,
  };

  cb.throwIfAborted?.();
  await recognizeImportedFolder(reqBase, ctx, ports, onMediaMetadataUpdated);

  cb.throwIfAborted?.();
  await recognizeImportedEpisodes(reqBase, ctx, ports, onMediaMetadataUpdated);
}
