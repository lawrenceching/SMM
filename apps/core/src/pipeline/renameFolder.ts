import { Path } from "@smm/utils/path";
import { renameFolderInMediaMetadata } from "../mediaMetadata";
import { renameFolderInUserConfig } from "../userConfig";
import type { MediaMetadataHelper } from "./mediaMetadataHelper";
import type { FsPort } from "../ports/FsPort";
import type { UserConfigHelper } from "./userConfigHelper";

export interface RenameFolderArgs {
  from: string;
  to: string;
}

export interface RenameFolderDeps {
  fs: FsPort;
  userConfig: UserConfigHelper;
  mediaMetadata: MediaMetadataHelper;
  normalizePosix: (path: string) => string;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

/** Mirrors packages/core-routes doRenameFolder orchestration (throws instead of { error }). */
export async function renameFolderPipeline(
  args: RenameFolderArgs,
  deps: RenameFolderDeps,
): Promise<void> {
  const fromAsPosix = Path.posix(args.from);
  const toAsPosix = Path.posix(args.to);

  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], args.from)) {
    throw new Error(`${fromAsPosix} is not managed by SMM`);
  }

  const mediaMetadata = await deps.mediaMetadata.read(fromAsPosix);
  if (!mediaMetadata) {
    throw new Error(`Media metadata not found: ${args.from}`);
  }

  const updatedMetadata = renameFolderInMediaMetadata(mediaMetadata, fromAsPosix, toAsPosix);
  if (!updatedMetadata.mediaFolderPath) {
    throw new Error("Media folder path is required");
  }

  await deps.mediaMetadata.move(
    fromAsPosix,
    Path.posix(updatedMetadata.mediaFolderPath),
    updatedMetadata,
  );

  await deps.userConfig.update((current) =>
    renameFolderInUserConfig(current, fromAsPosix, toAsPosix),
  );

  await deps.fs.rename(fromAsPosix, toAsPosix);
}
