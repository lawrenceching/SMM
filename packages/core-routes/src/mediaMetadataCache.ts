import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Path } from "@smm/core/path";
import type { MediaMetadata } from "@smm/core/types";

export function metadataCacheFilePath(
  appDataDir: string,
  folderPathInPosix: string,
): string {
  const filename = folderPathInPosix.replace(/[\/\\:?*|<>"]/g, "_");
  return path.join(appDataDir, "metadata", `${filename}.json`);
}

export async function readMediaMetadataCache(
  appDataDir: string,
  mediaFolderPath: string,
): Promise<MediaMetadata | null> {
  const folderPathInPosix = Path.posix(mediaFolderPath);
  const filePath = metadataCacheFilePath(appDataDir, folderPathInPosix);

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as MediaMetadata;
  } catch {
    return null;
  }
}

export async function writeMediaMetadataCache(
  appDataDir: string,
  mediaMetadata: MediaMetadata,
): Promise<void> {
  if (!mediaMetadata.mediaFolderPath) {
    throw new Error("Media folder path is required");
  }

  const metadataDir = path.join(appDataDir, "metadata");
  await mkdir(metadataDir, { recursive: true });
  const filePath = metadataCacheFilePath(
    appDataDir,
    Path.posix(mediaMetadata.mediaFolderPath),
  );
  await writeFile(filePath, JSON.stringify(mediaMetadata, null, 2), "utf-8");
}

export async function deleteMediaMetadataCache(
  appDataDir: string,
  mediaFolderPath: string,
): Promise<void> {
  const filePath = metadataCacheFilePath(appDataDir, Path.posix(mediaFolderPath));
  try {
    await unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}
