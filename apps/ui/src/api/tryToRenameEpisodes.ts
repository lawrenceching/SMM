import type { RenameFilesPlan } from '@smm/types/RenameFilesPlan'
import { apiFetch } from '@/lib/apiFetch'

export type RenameRuleName = 'plex' | 'emby'

export interface TryToRenameEpisodesRequest {
  mediaFolderPath: string
  rule?: RenameRuleName
}

export interface TryToRenameEpisodesResponseBody {
  data?: { plan: RenameFilesPlan }
  error?: string
}

/** POST /api/try-to-rename-episodes — build a pending rename-files plan. */
export async function tryToRenameEpisodes(
  request: TryToRenameEpisodesRequest,
  signal?: AbortSignal,
): Promise<TryToRenameEpisodesResponseBody> {
  const resp = await apiFetch('/api/try-to-rename-episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`Failed to try-to-rename-episodes: ${resp.statusText}`)
  }

  return (await resp.json()) as TryToRenameEpisodesResponseBody
}
