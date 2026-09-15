import { Path } from "@smm/utils/path";
import type { FolderType, MediaMetadata } from "@smm/types";
import type { LoggerPort } from "../ports/LoggerPort";
import type { JobStage } from "../jobs/types";
import type { MediaMetadataHelper } from "./mediaMetadataHelper";
import type { UserConfigHelper } from "./userConfigHelper";
import { autoRecognizeFolderPipeline, type RecognizeFolderDeps } from "./recognizeFolder";
import { recognizeMediaFilesPipeline } from "./recognizeMediaFiles";

/** Stage 1 only needs the two stores it writes to. */
export interface PersistNewFolderDeps {
  userConfig: UserConfigHelper;
  mediaMetadata: MediaMetadataHelper;
}

/**
 * Stages 2 and 3 run the same core methods as the user-triggered recognition
 * flows, so they take the same dependency bag plus a logger.
 */
export interface FolderInitializationDeps extends RecognizeFolderDeps {
  logger: LoggerPort;
}

export interface FolderInitializationCallbacks {
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
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
 * `importFolder` returns to the caller once this stage completed.
 */
export async function persistNewFolder(
  folderPath: string,
  type: FolderType,
  deps: PersistNewFolderDeps,
): Promise<MediaMetadata> {
  await deps.userConfig.addFolder(folderPath);
  const blank = createBlankMediaMetadata(folderPath, type);
  await deps.mediaMetadata.write(blank);
  return blank;
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
  const posixPath = deps.normalizePosix(folderPath);
  // Listing once up front feeds both stages and fails initialization of an unreadable folder.
  const filePaths = (await deps.fs.listFiles(posixPath)).map((file) => Path.posix(file));
  if (type !== "tvshow" && type !== "movie") return;

  deps.logger.info({ folderPath: posixPath, type }, "importFolder: stage=recognizeFolder");
  const result = await autoRecognizeFolderPipeline(folderPath, deps, filePaths);
  const title = result.tvShow?.name ?? result.movie?.name;
  cb.onStage?.("recognizeFolder", 60, title !== undefined ? { title } : undefined);

  deps.logger.info({ folderPath: posixPath }, "importFolder: stage=recognizeEpisodes");
  await recognizeMediaFilesPipeline(folderPath, deps, filePaths);
  cb.onStage?.("recognizeEpisodes", 90);
}
