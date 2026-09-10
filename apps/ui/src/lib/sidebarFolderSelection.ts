import { Path } from "@smm/utils/path"

/**
 * Pure UI selection transition for sidebar folder list (single / multi).
 */
export function nextFolderSelection(
  currentSelected: readonly string[],
  path: string,
  multi: boolean,
): { selectedPaths: string[]; primaryPath: string } {
  if (!multi) {
    return { selectedPaths: [path], primaryPath: path }
  }
  const next = new Set(currentSelected)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return {
    selectedPaths: [...next],
    primaryPath: path,
  }
}

export function isPathInSelection(path: string, selectedPaths: readonly string[]): boolean {
  const posix = Path.posix(path)
  return selectedPaths.some((p) => Path.posix(p) === posix)
}
