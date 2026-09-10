import { useMutation, useQueryClient } from "@tanstack/react-query"
import { rejectPlan } from "@/api/rejectPlan"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

export interface RejectPlanVariables {
  id: string
  mediaFolderPath: string
}

/**
 * Reject a plan and remove it from the plans cache.
 */
export function useRejectPlanMutation() {
  const queryClient = useQueryClient()

  return useMutation<null, Error, RejectPlanVariables>({
    mutationFn: async ({ id }): Promise<null> => {
      const resp = await rejectPlan({ id })
      if (resp.error) {
        throw new Error(resp.error)
      }
      return null
    },
    onSuccess: (_data, { id, mediaFolderPath }) => {
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) =>
        (prev ?? []).filter((p) => p.id !== id),
      )
    },
  })
}
