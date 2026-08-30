import { apiFetch } from '@/lib/apiFetch'
import type { MediaMetadata } from '@core/types'
import type { UIMediaFolderStatus } from '@/types/UIMediaFolder'

export type ShowFolderStatus = Extract<
  UIMediaFolderStatus,
  'ok' | 'folder_not_found' | 'error_loading_metadata'
>

export interface ShowFolderResult {
  path: string
  status: ShowFolderStatus
  type?: MediaMetadata['type']
  title?: string
}

export interface ShowFolderResponseBody {
  data?: ShowFolderResult
  error?: string
}

/** Resolve folder display status via Core (`POST /api/show-folder`). */
export async function showFolder(path: string, signal?: AbortSignal): Promise<ShowFolderResponseBody> {
  const resp = await apiFetch('/api/show-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as ShowFolderResponseBody
}

/** Throws on business error; returns show-folder payload. */
export async function showFolderViaCore(path: string, signal?: AbortSignal): Promise<ShowFolderResult> {
  const body = await showFolder(path, signal)
  if (body.error) {
    throw new Error(body.error)
  }
  if (!body.data) {
    throw new Error('Error Reason: show-folder result missing')
  }
  return body.data
}
