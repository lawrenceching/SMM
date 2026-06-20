import { skipToken, useQuery } from "@tanstack/react-query"
import { getPlans, type Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { PLANS_QUERY_ROOT, plansQueryKey } from "./plansQueryKeys"

const noFolderPlansQueryKey = [PLANS_QUERY_ROOT, null] as const

/**
 * Active (`preparing`/`pending`) plans for a media folder, backed by
 * the unified `/api/getPlans` endpoint. Pass `undefined` to skip.
 */
export function usePlansQuery(mediaFolderPath: string | undefined) {
  const trimmed = mediaFolderPath?.trim() ?? ""
  const folderPosix = trimmed ? normalizeMediaFolderPathForQuery(trimmed) : ""

  return useQuery<Plan[]>({
    queryKey: folderPosix ? plansQueryKey(folderPosix) : noFolderPlansQueryKey,
    queryFn: folderPosix
      ? async (): Promise<Plan[]> => {
          const resp = await getPlans(folderPosix)
          if (resp.error) {
            throw new Error(resp.error)
          }
          return resp.data?.plans ?? []
        }
      : skipToken,
  })
}
