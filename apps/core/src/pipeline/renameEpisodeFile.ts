import { Path } from "@core/path";
import { updateMediaMetadataAfterRename } from "@core/mediaMetadata";
import type { MediaMetadata } from "@smm/core";
import { validateRenameOperations } from "@core/validations/rename/validateRenameOperations";
import type { RenameFileExistenceProbe } from "@core/validations/rename/validateRenameFileExistence";
import type { FsPort } from "../ports/FsPort";
import { expandAssociatedFileRenames } from "./expandAssociatedFileRenames";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { dirname } from "./paths";
import type { UserConfigHelper } from "./userConfigHelper";

function renameFileExistenceProbe(fs: FsPort): RenameFileExistenceProbe {
  return {
    isFile: async (path: string): Promise<boolean> => {
      if (fs.isFile) {
        return fs.isFile(path);
      }
      return fs.exists(path);
    },
  };
}

export interface RenameEpisodeFileInput {
  mediaFolderPath: string;
  from: string;
  to: string;
}

export interface RenameEpisodeFileResult {
  succeeded: Array<{ from: string; to: string }>;
  failed: Array<{ path: string; error: string }>;
}

export interface RenameEpisodeFileDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfigHelper;
  normalizePosix: (path: string) => string;
  getMediaMetadata: (folder: string) => Promise<MediaMetadata | null>;
  setMetadata: (mm: MediaMetadata) => Promise<void>;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

function isUnderFolder(folderPosix: string, filePosix: string): boolean {
  const prefix = folderPosix.endsWith("/") ? folderPosix : `${folderPosix}/`;
  return filePosix === folderPosix || filePosix.startsWith(prefix);
}

function isSupportedMediaFolderType(
  type: MediaMetadata["type"],
): type is "tvshow-folder" | "movie-folder" {
  return type === "tvshow-folder" || type === "movie-folder";
}

/** TV: linked episode with season/episode. Movie: any entry in mediaFiles (video path). */
function isLinkedMediaFile(mm: MediaMetadata, fromPosix: string): boolean {
  return (mm.mediaFiles ?? []).some((f) => {
    if (!mediaFilePathEqual(f.absolutePath, fromPosix)) {
      return false;
    }
    if (mm.type === "movie-folder") {
      return true;
    }
    return f.seasonNumber !== undefined && f.episodeNumber !== undefined;
  });
}

/** Rename a linked TV episode or movie video file (+ same-stem associates). Throws on prerequisite failure. */
export async function renameEpisodeFilePipeline(
  input: RenameEpisodeFileInput,
  deps: RenameEpisodeFileDeps,
): Promise<RenameEpisodeFileResult> {
  const mediaFolderRaw = input.mediaFolderPath?.trim() ?? "";
  const fromRaw = input.from?.trim() ?? "";
  const toRaw = input.to?.trim() ?? "";

  if (mediaFolderRaw === "") {
    throw new Error("mediaFolder is required");
  }
  if (fromRaw === "") {
    throw new Error("from is required");
  }
  if (toRaw === "") {
    throw new Error("to is required");
  }

  const folderPosix = deps.normalizePosix(mediaFolderRaw);
  const fromPosix = deps.normalizePosix(fromRaw);
  const toPosix = deps.normalizePosix(toRaw);

  if (fromPosix === toPosix) {
    throw new Error("from and to must differ");
  }

  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], mediaFolderRaw)) {
    throw new Error(`${folderPosix} is not managed by SMM`);
  }

  const mm = await deps.getMediaMetadata(folderPosix);
  if (!mm) {
    throw new Error(`Media metadata not found: ${mediaFolderRaw}`);
  }
  if (!isSupportedMediaFolderType(mm.type)) {
    throw new Error(`Folder is not a TV show or movie: ${mediaFolderRaw}`);
  }
  if (!isLinkedMediaFile(mm, fromPosix)) {
    const detail =
      mm.type === "movie-folder"
        ? "File is not a linked movie video"
        : "File is not a linked episode";
    throw new Error(`${detail}: ${fromRaw}`);
  }
  if (!isUnderFolder(folderPosix, fromPosix)) {
    throw new Error(`Path is outside media folder: ${fromRaw}`);
  }
  if (!isUnderFolder(folderPosix, toPosix)) {
    throw new Error(`Path is outside media folder: ${toRaw}`);
  }

  const localFiles = (await deps.fs.listFiles(folderPosix)).map((p) => Path.posix(p));
  const associates = expandAssociatedFileRenames(fromPosix, toPosix, localFiles);
  const renameList: Array<{ from: string; to: string }> = [
    { from: fromPosix, to: toPosix },
    ...associates,
  ];

  const validation = await validateRenameOperations(
    renameList,
    folderPosix,
    renameFileExistenceProbe(deps.fs),
  );
  if (!validation.isValid) {
    throw new Error(validation.errors.join("; "));
  }

  const succeeded: Array<{ from: string; to: string }> = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const pair of renameList) {
    try {
      await deps.fs.mkdir(dirname(pair.to));
      await deps.fs.rename(pair.from, pair.to);
      succeeded.push(pair);
    } catch (error) {
      failed.push({
        path: pair.from,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (succeeded.length > 0) {
    const updated = updateMediaMetadataAfterRename(mm, succeeded);
    await deps.setMetadata({ ...updated, mediaFolderPath: folderPosix });
  }

  return { succeeded, failed };
}
