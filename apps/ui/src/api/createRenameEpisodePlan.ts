import type { PlanCreator } from '@smm/types/planCommon'
import type { RenameFilesPlan } from '@smm/types/RenameFilesPlan'
import { apiFetch } from '@/lib/apiFetch'

export interface CreateRenameEpisodePlanRequest {
  mediaFolderPath: string
  files: Array<{ from: string; to: string }>
  creator: PlanCreator
}

export interface CreateRenameEpisodePlanResponseBody {
  data?: { plan: RenameFilesPlan }
  error?: string
}

export async function createRenameEpisodePlanApi(
  request: CreateRenameEpisodePlanRequest,
  signal?: AbortSignal,
): Promise<CreateRenameEpisodePlanResponseBody> {
  const resp = await apiFetch('/api/create-rename-episode-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as CreateRenameEpisodePlanResponseBody
}
