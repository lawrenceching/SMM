import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

/** Root key for all plan queries. Used for broad invalidation (e.g. socket events). */
export const PLANS_QUERY_ROOT = "plans" as const

/** Per-folder plan query key. */
export function plansQueryKey(mediaFolderPath: string) {
  return [PLANS_QUERY_ROOT, normalizeMediaFolderPathForQuery(mediaFolderPath)] as const
}
