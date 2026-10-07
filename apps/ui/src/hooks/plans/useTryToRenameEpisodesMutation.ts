import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  tryToRenameEpisodes,
  type RenameRuleName,
} from "@/api/tryToRenameEpisodes"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

export interface TryToRenameEpisodesVariables {
  mediaFolderPath: string
  rule?: RenameRuleName
}

/**
 * POST /api/try-to-rename-episodes — build a pending rename-files plan and
 * add it to the plans cache.
 */
export function useTryToRenameEpisodesMutation() {
  const queryClient = useQueryClient()

  return useMutation<Plan, Error, TryToRenameEpisodesVariables>({
    mutationFn: async ({ mediaFolderPath, rule }): Promise<Plan> =>
      tryToRenameEpisodes({ mediaFolderPath, rule }),
    onSuccess: (plan, { mediaFolderPath }) => {
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) => {
        const rest = (prev ?? []).filter((p) => p.id !== plan.id)
        return [...rest, plan]
      })
    },
  })
}
