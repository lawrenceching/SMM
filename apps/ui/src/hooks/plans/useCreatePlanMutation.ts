import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Path } from "@core/path"
import { createPlan, type CreatePlanRequest } from "@/api/createPlan"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

function buildOptimisticPlan(request: CreatePlanRequest): Plan {
  const id =
    request.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const mediaFolderPath = Path.posix(request.mediaFolderPath)
  if (request.task === "recognize-media-file") {
    return {
      id,
      task: "recognize-media-file",
      status: "preparing",
      creator: request.creator,
      mediaFolderPath,
      files: [],
    }
  }
  return {
    id,
    task: "rename-files",
    status: "preparing",
    creator: request.creator,
    mediaFolderPath,
    files: [],
  }
}

/**
 * Create a `preparing` plan with an optimistic cache insert. The
 * returned `createPlanOptimistic` resolves to the created plan so
 * callers can immediately compute + `useUpdatePlanMutation` it.
 */
export function useCreatePlanMutation() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (request: CreatePlanRequest): Promise<Plan> => {
      const resp = await createPlan(request)
      if (resp.error || !resp.data) {
        throw new Error(resp.error ?? "createPlan: empty response")
      }
      return resp.data.plan
    },
  })

  const createPlanOptimistic = async (
    request: CreatePlanRequest,
  ): Promise<Plan> => {
    const folderPosix = normalizeMediaFolderPathForQuery(request.mediaFolderPath)
    const key = plansQueryKey(folderPosix)
    const optimistic = buildOptimisticPlan(request)
    const previous = queryClient.getQueryData<Plan[]>(key)

    queryClient.setQueryData<Plan[]>(key, (prev) => [...(prev ?? []), optimistic])

    try {
      const created = await mutation.mutateAsync({ ...request, id: optimistic.id })
      queryClient.setQueryData<Plan[]>(key, (prev) =>
        (prev ?? []).map((p) => (p.id === optimistic.id ? created : p)),
      )
      return created
    } catch (error) {
      queryClient.setQueryData<Plan[]>(key, previous)
      throw error
    }
  }

  return { ...mutation, createPlanOptimistic }
}
