import { Path } from "@core/path";

export function joinPosix(...parts: string[]): string {
  return parts.join("/");
}

export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export function extname(path: string): string {
  const base = basename(path);
  const idx = base.lastIndexOf(".");
  return idx < 0 ? "" : base.slice(idx);
}

/** `<appDataDir>/smm.json`, in POSIX form. */
export function userConfigPath(appDataDir: string): string {
  return joinPosix(Path.posix(appDataDir), "smm.json");
}

/** `<appDataDir>/plans/{id}.plan.json`, POSIX form (same layout as core-routes). */
export function planFilePath(appDataDir: string, planId: string): string {
  return joinPosix(Path.posix(appDataDir), "plans", `${planId}.plan.json`);
}

/**
 * Metadata cache file for a media folder, mirroring `metadataCacheFilePath`
 * in `apps/ui/src/api/readMediaMetadataV2.ts`. POSIX form.
 */
export function metadataCachePath(appDataDir: string, folderPathInPosix: string): string {
  const filename = folderPathInPosix.replace(/[/\\:?*|<>"]/g, "_");
  return joinPosix(Path.posix(appDataDir), "metadata", `${filename}.json`);
}
