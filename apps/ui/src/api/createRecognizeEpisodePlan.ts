import type { PlanCreator } from '@smm/types/planCommon'
import { rpc, unwrapJson } from '@/lib/rpc'

export interface CreateRecognizeEpisodePlanRequest {
  mediaFolderPath: string
  files: Array<{ season: number; episode: number; path: string }>
  creator: PlanCreator
}

type CreateRecognizeEpisodePlanResponseBody = Awaited<
  ReturnType<
    Awaited<ReturnType<(typeof rpc)['api']['create-recognize-episode-plan']['$post']>>['json']
  >
>

export async function createRecognizeEpisodePlanApi(
  request: CreateRecognizeEpisodePlanRequest,
  signal?: AbortSignal,
): Promise<CreateRecognizeEpisodePlanResponseBody> {
  const resp = await rpc.api['create-recognize-episode-plan'].$post(
    { json: request },
    { init: { signal } },
  )
  return unwrapJson(resp)
}
