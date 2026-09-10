import { Path } from "@smm/utils/path"

/**
 * Union of persisted folder paths (`get-folders`) and optimistic UI store paths
 * (e.g. folders upserted while an import job is still running). Dedupes by POSIX path;
 * prefers the query path string when both refer to the same folder.
 */
export function mergeFolderListPaths(
  queryPaths: string[] | undefined,
  storePaths: string[],
): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const path of queryPaths ?? []) {
    const key = Path.posix(path)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(path)
  }

  for (const path of storePaths) {
    const key = Path.posix(path)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(path)
  }

  return merged
}
