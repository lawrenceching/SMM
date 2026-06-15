/**
 * Frontend HTTP API wrapper for `POST /api/getEpisodes`.
 *
 * Used by the frontend `GetEpisodes` AI tool when the browser must
 * delegate disk reads to the CLI backend.
 */

import type { GetEpisodesToolOutput } from '@core/types/ai-tools/getEpisodes'

export type GetEpisodesResponseBody = GetEpisodesToolOutput

export interface GetEpisodesRequestBody {
  mediaFolderPath: string
}

export async function getEpisodes(
  params: GetEpisodesRequestBody,
  signal?: AbortSignal,
): Promise<GetEpisodesResponseBody> {
  const resp = await fetch('/api/getEpisodes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!resp.ok) {
    throw new Error(
      `getEpisodes: HTTP ${resp.status} ${resp.statusText}`,
    )
  }

  return (await resp.json()) as GetEpisodesResponseBody
}
