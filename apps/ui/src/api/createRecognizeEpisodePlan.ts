import type { PlanCreator } from '@smm/types/planCommon'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { apiFetch } from '@/lib/apiFetch'

export interface CreateRecognizeEpisodePlanRequest {
  mediaFolderPath: string
  files: Array<{ season: number; episode: number; path: string }>
  creator: PlanCreator
}

export interface CreateRecognizeEpisodePlanResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

export async function createRecognizeEpisodePlanApi(
  request: CreateRecognizeEpisodePlanRequest,
  signal?: AbortSignal,
): Promise<CreateRecognizeEpisodePlanResponseBody> {
  const resp = await apiFetch('/api/create-recognize-episode-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as CreateRecognizeEpisodePlanResponseBody
}
