import { Path } from "@core/path";

/** Skip folders already present in user config (POSIX path comparison). */
export function dedupLibraryFolders(newFolders: string[], existingFolderPaths: string[]): string[] {
  const importedPosix = new Set(existingFolderPaths.map((p) => Path.posix(p)));
  return newFolders.filter((folder) => !importedPosix.has(Path.posix(folder)));
}
