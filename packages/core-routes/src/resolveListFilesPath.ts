import path from "node:path";
import { Path } from "@smm/core/path";

/**
 * Join a child name to a directory path used by list-files.
 * `path.join` corrupts HarmonyOS `file://docs/...` URIs.
 */
export function joinListFilesChildPath(dirPath: string, childName: string): string {
  if (dirPath.startsWith("file://")) {
    const separator = dirPath.endsWith("/") ? "" : "/";
    return `${dirPath}${separator}${childName}`;
  }
  return path.join(dirPath, childName);
}

/**
 * Resolve a list-files path for `node:fs` operations.
 *
 * HarmonyOS media folders use persisted `file://docs/...` URIs.
 * `path.resolve` must not be applied to those URIs — it corrupts
 * them into invalid filesystem paths (e.g. `cwd/file:/docs/...`).
 */
export function resolveListFilesAbsolutePath(folderPath: string): string {
  if (folderPath.startsWith("file://")) {
    return folderPath;
  }
  return path.resolve(folderPath);
}

/**
 * Normalize a user-supplied folder path before resolution.
 * Mirrors the platform-specific rules used by {@link doListFiles}.
 */
export function normalizeListFilesInputPath(folderPath: string): string {
  if (folderPath.startsWith("file://")) {
    return folderPath;
  }

  if (folderPath.startsWith("/") && Path.isWindows()) {
    const normalizedPosixPath = folderPath.replace(/^\/([A-Za-z]):\//, "/$1/");
    return Path.win(normalizedPosixPath);
  }

  if (/^[A-Za-z]:/.test(folderPath) && !Path.isWindows()) {
    return new Path(folderPath).abs("posix");
  }

  return Path.toPlatformPath(folderPath);
}
