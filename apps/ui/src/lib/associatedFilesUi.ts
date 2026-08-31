import { Path } from "@smm/utils/path";
import { findAssociatedFiles as findAssociatedPaths } from "@smm/core/pipeline/findAssociatedFiles";
import {
  extensions,
  imageFileExtensions,
  subtitleFileExtensions,
} from "@smm/types/mediaFileExtensions";
import { basename, relative } from "@/lib/path";

export type AssociatedFileTag = "SUB" | "AUD" | "NFO" | "POSTER" | "VID";

export interface TaggedAssociatedFile {
  path: string;
  tag: AssociatedFileTag;
  newPath: string;
}

function getRelativePath(absolutePath: string, mediaFolderPath: string | undefined): string {
  if (!mediaFolderPath) {
    return absolutePath;
  }
  try {
    return relative(mediaFolderPath, absolutePath);
  } catch {
    return absolutePath;
  }
}

function tagForPath(absolutePath: string): AssociatedFileTag {
  const name = basename(absolutePath) ?? absolutePath;
  if (imageFileExtensions.some((ext) => name.endsWith(ext))) return "POSTER";
  if (subtitleFileExtensions.some((ext) => name.endsWith(ext))) return "SUB";
  if (extensions.audioTrackFileExtensions.some((ext) => name.endsWith(ext))) return "AUD";
  if (name.endsWith(".nfo")) return "NFO";
  return "VID";
}

/**
 * UI adapter over pure {@link findAssociatedPaths}: returns relative paths with tags
 * for table/row rendering.
 */
export function findAssociatedFiles(
  mediaFolderPath: string,
  filePaths: string[],
  videoFilePath: string,
): TaggedAssociatedFile[] {
  const absolute = findAssociatedPaths(mediaFolderPath, filePaths, videoFilePath);
  return absolute.map((abs) => ({
    path: getRelativePath(abs, mediaFolderPath),
    tag: tagForPath(abs),
    newPath: "N/A",
  }));
}

/** Absolute POSIX paths (same as pure). */
export function findAssociatedFilePaths(
  mediaFolderPath: string,
  filePaths: string[],
  videoFilePath: string,
): string[] {
  return findAssociatedPaths(mediaFolderPath, filePaths, videoFilePath).map((p) =>
    Path.posix(p),
  );
}
