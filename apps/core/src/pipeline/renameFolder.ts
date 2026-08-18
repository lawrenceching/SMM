import { Path } from "@core/path";
import { renameFolderInMediaMetadata } from "@core/mediaMetadata";
import { renameFolderInUserConfig } from "@core/userConfig";
import type { MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath } from "./paths";
import type { UserConfig } from "./userConfig";

export interface RenameFolderArgs {
  from: string;
  to: string;
}

export interface RenameFolderDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfig;
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

  const cachePath = metadataCachePath(deps.appDataDir, fromAsPosix);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${args.from}`);
  }
  let mediaMetadata: MediaMetadata;
  try {
    mediaMetadata = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
    throw new Error(`Media metadata not found: ${args.from}`);
  }

  const updatedMetadata = renameFolderInMediaMetadata(mediaMetadata, fromAsPosix, toAsPosix);
  if (!updatedMetadata.mediaFolderPath) {
    throw new Error("Media folder path is required");
  }
  const newCachePath = metadataCachePath(deps.appDataDir, Path.posix(updatedMetadata.mediaFolderPath));
  await deps.fs.writeTextFile(newCachePath, JSON.stringify(updatedMetadata, null, 2));
  await deps.fs.deleteFile(cachePath);

  await deps.userConfig.update((current) =>
    renameFolderInUserConfig(current, fromAsPosix, toAsPosix),
  );

  await deps.fs.rename(fromAsPosix, toAsPosix);
}
