import type { RenameFilesPlan } from '@smm/types/RenameFilesPlan'
import { rpc, unwrapJson } from '@/lib/rpc'

export type RenameRuleName = 'plex' | 'emby'

export interface TryToRenameEpisodesRequest {
  mediaFolderPath: string
  rule?: RenameRuleName
}

/** POST /api/try-to-rename-episodes — build a pending rename-files plan. */
export async function tryToRenameEpisodes(
  request: TryToRenameEpisodesRequest,
  signal?: AbortSignal,
): Promise<RenameFilesPlan> {
  const resp = await rpc.api['try-to-rename-episodes'].$post(
    { json: request },
    { init: { signal } },
  )
  const body = await unwrapJson(resp)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data.plan
}
