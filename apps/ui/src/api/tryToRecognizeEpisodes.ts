import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { rpc, unwrapJson } from '@/lib/rpc'

export interface TryToRecognizeEpisodesRequest {
  mediaFolderPath: string
}

/** POST /api/try-to-recognize-episodes — build a pending recognize-media-file plan. */
export async function tryToRecognizeEpisodes(
  request: TryToRecognizeEpisodesRequest,
  signal?: AbortSignal,
): Promise<RecognizeMediaFilePlan> {
  const resp = await rpc.api['try-to-recognize-episodes'].$post(
    { json: request },
    { init: { signal } },
  )
  const body = await unwrapJson(resp)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data.plan
}
