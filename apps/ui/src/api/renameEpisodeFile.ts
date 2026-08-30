import { apiFetch } from '@/lib/apiFetch'

export interface RenameEpisodeFileParams {
  mediaFolder: string
  from: string
  to: string
}

export interface RenameEpisodeFileResponseBody {
  data?: {
    succeeded: Array<{ from: string; to: string }>
    failed: Array<{ path: string; error: string }>
  }
  error?: string
}

/** Layer-2 episode rename via Core (`POST /api/rename-episode-file`). */
export async function renameEpisodeFile(
  params: RenameEpisodeFileParams,
  signal?: AbortSignal,
): Promise<RenameEpisodeFileResponseBody> {
  const resp = await apiFetch('/api/rename-episode-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaFolder: params.mediaFolder,
      from: params.from,
      to: params.to,
    }),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as RenameEpisodeFileResponseBody
}

/** Throws on business error or per-file failures. */
export async function renameEpisodeFileViaCore(
  params: RenameEpisodeFileParams,
): Promise<void> {
  const body = await renameEpisodeFile(params)
  if (body.error) {
    throw new Error(body.error)
  }
  const failed = body.data?.failed ?? []
  if (failed.length > 0) {
    throw new Error(failed.map((f) => f.error).join(', ') || 'Rename failed')
  }
}
