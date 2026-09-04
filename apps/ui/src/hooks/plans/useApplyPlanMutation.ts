import { useMutation, useQueryClient } from "@tanstack/react-query"
import { applyPlan } from "@/api/applyPlan"
import type { Plan } from "@/api/getPlans"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

export interface ApplyPlanVariables {
  id: string
  mediaFolderPath: string
  /** UC3: selected "from" files; when set, only these entries are applied. */
  files?: string[]
}

/**
 * Apply a plan, remove it from the plans cache and invalidate the
 * media metadata query (files on disk have changed).
 */
export function useApplyPlanMutation() {
  const queryClient = useQueryClient()

  return useMutation<null, Error, ApplyPlanVariables>({
    mutationFn: async ({ id, files }): Promise<null> => {
      const resp = await applyPlan({
        id,
        data: files && files.length > 0 ? { files } : undefined,
      })
      if (resp.error) {
        throw new Error(resp.error)
      }
      return null
    },
    onSuccess: (_data, { id, mediaFolderPath }) => {
      const plansKey = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(plansKey, (prev) =>
        (prev ?? []).filter((p) => p.id !== id),
      )
      const pathPosix = normalizeMediaFolderPathForQuery(mediaFolderPath)
      void queryClient.invalidateQueries({ queryKey: mediaMetadataQueryKey(pathPosix) })
    },
  })
}
