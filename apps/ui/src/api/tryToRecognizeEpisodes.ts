import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { apiFetch } from '@/lib/apiFetch'

export interface TryToRecognizeEpisodesRequest {
  mediaFolderPath: string
}

export interface TryToRecognizeEpisodesResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

/** POST /api/try-to-recognize-episodes — build a pending recognize-media-file plan. */
export async function tryToRecognizeEpisodes(
  request: TryToRecognizeEpisodesRequest,
  signal?: AbortSignal,
): Promise<TryToRecognizeEpisodesResponseBody> {
  const resp = await apiFetch('/api/try-to-recognize-episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`Failed to try-to-recognize-episodes: ${resp.statusText}`)
  }

  return (await resp.json()) as TryToRecognizeEpisodesResponseBody
}
