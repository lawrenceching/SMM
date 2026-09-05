import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"
import { tryToRecognizeEpisodes } from "@/api/tryToRecognizeEpisodes"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

export interface TryToRecognizeEpisodesVariables {
  mediaFolderPath: string
}

/**
 * POST /api/try-to-recognize-episodes — build a pending recognize-media-file
 * plan and add it to the plans cache.
 */
export function useTryToRecognizeEpisodesMutation() {
  const queryClient = useQueryClient()

  return useMutation<RecognizeMediaFilePlan, Error, TryToRecognizeEpisodesVariables>({
    mutationFn: async ({ mediaFolderPath }): Promise<RecognizeMediaFilePlan> => {
      const resp = await tryToRecognizeEpisodes({ mediaFolderPath })
      if (resp.error || !resp.data?.plan) {
        throw new Error(resp.error ?? "Failed to create recognize plan")
      }
      return resp.data.plan as RecognizeMediaFilePlan
    },
    onSuccess: (plan, { mediaFolderPath }) => {
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) => {
        const rest = (prev ?? []).filter((p) => p.id !== plan.id)
        return [...rest, plan]
      })
    },
  })
}
