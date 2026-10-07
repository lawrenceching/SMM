import type { PlanCreator } from '@smm/types/planCommon'
import { rpc, unwrapJson } from '@/lib/rpc'

export interface CreateRenameEpisodePlanRequest {
  mediaFolderPath: string
  files: Array<{ from: string; to: string }>
  creator: PlanCreator
}

type CreateRenameEpisodePlanResponseBody = Awaited<
  ReturnType<
    Awaited<ReturnType<(typeof rpc)['api']['create-rename-episode-plan']['$post']>>['json']
  >
>

export async function createRenameEpisodePlanApi(
  request: CreateRenameEpisodePlanRequest,
  signal?: AbortSignal,
): Promise<CreateRenameEpisodePlanResponseBody> {
  const resp = await rpc.api['create-rename-episode-plan'].$post(
    { json: request },
    { init: { signal } },
  )
  return unwrapJson(resp)
}
