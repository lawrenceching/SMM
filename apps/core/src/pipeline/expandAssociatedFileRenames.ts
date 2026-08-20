import { basename, dirname, extname, joinPosix } from "./paths";

/**
 * Port of UI `computeAssociatedFileRenames`: same-stem siblings stay in their
 * current directory; only the basename stem changes.
 *
 * Paths are POSIX. Does not include the episode file itself.
 */
export function expandAssociatedFileRenames(
  episodeOldPath: string,
  episodeNewPath: string,
  allFilesInFolder: string[],
): Array<{ from: string; to: string }> {
  const oldBasename = basename(episodeOldPath);
  const oldExt = extname(oldBasename);
  const oldStem = oldBasename.slice(0, oldBasename.length - oldExt.length);

  const newBasename = basename(episodeNewPath);
  const newExt = extname(newBasename);
  const newStem = newBasename.slice(0, newBasename.length - newExt.length);

  if (!oldStem || !newStem || oldStem === newStem) {
    return [];
  }

  const renames: Array<{ from: string; to: string }> = [];
  for (const filePath of allFilesInFolder) {
    if (filePath === episodeOldPath) continue;

    const assocBasename = basename(filePath);
    if (assocBasename === oldStem || assocBasename.startsWith(oldStem + ".")) {
      const suffix = assocBasename.slice(oldStem.length);
      const newAssocBasename = newStem + suffix;
      const assocDir = dirname(filePath);
      renames.push({
        from: filePath,
        to: joinPosix(assocDir, newAssocBasename),
      });
    }
  }
  return renames;
}
