import { useMutation, useQueryClient } from "@tanstack/react-query"
import { isTerminalPlanStatus } from "@core/types/planCommon"
import { updatePlan, type UpdatePlanPatch } from "@/api/updatePlan"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import type { UIPlan } from "@/types/UIPlan"
import { plansQueryKey } from "./plansQueryKeys"

export function toUpdatePlanPatch(patch: Partial<UIPlan>): UpdatePlanPatch {
  return {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.files !== undefined ? { files: patch.files } : {}),
  }
}

export interface UpdatePlanVariables {
  id: string
  mediaFolderPath: string
  patch: UpdatePlanPatch
}

/**
 * Patch a plan's status/files with optimistic cache updates. Terminal
 * statuses (`completed`/`rejected`) remove the plan from the cache.
 */
export function useUpdatePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation<Plan | null, Error, UpdatePlanVariables, { key: readonly unknown[]; previous: Plan[] | undefined }>({
    mutationFn: async ({ id, patch }): Promise<Plan | null> => {
      const resp = await updatePlan(id, patch)
      if (resp.error) {
        throw new Error(resp.error)
      }
      return resp.data?.plan ?? null
    },
    onMutate: async ({ id, mediaFolderPath, patch }) => {
      const folderPosix = normalizeMediaFolderPathForQuery(mediaFolderPath)
      const key = plansQueryKey(folderPosix)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Plan[]>(key)

      const terminal = patch.status !== undefined && isTerminalPlanStatus(patch.status)
      queryClient.setQueryData<Plan[]>(key, (prev) => {
        const list = prev ?? []
        if (terminal) {
          return list.filter((p) => p.id !== id)
        }
        return list.map((p) =>
          p.id === id
            ? ({
                ...p,
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.files !== undefined ? { files: patch.files } : {}),
              } as Plan)
            : p,
        )
      })

      return { key, previous }
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData<Plan[]>(context.key, context.previous)
      }
    },
  })
}
