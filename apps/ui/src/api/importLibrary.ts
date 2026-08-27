import { apiFetch } from '@/lib/apiFetch'
import type { FolderType } from '@core/types'

export interface ImportLibraryParams {
  path: string
  type: FolderType | 'anime'
  skipInit?: boolean
}

export interface ImportLibraryResponseBody {
  data?: { id: string }
  error?: string
}

/** Layer-2 import library via Core (`POST /api/import-library`). */
export async function importLibrary(
  params: ImportLibraryParams,
  signal?: AbortSignal,
): Promise<ImportLibraryResponseBody> {
  const body: Record<string, string | boolean> = {
    path: params.path,
    type: params.type,
  }
  if (params.skipInit === true) {
    body.skipInit = true
  }

  const resp = await apiFetch('/api/import-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as ImportLibraryResponseBody
}

/** Throws on business error; returns job id. */
export async function importLibraryViaCore(params: ImportLibraryParams): Promise<string> {
  const data = await importLibrary(params)
  if (data.error) {
    throw new Error(data.error)
  }
  if (!data.data?.id) {
    throw new Error('Error Reason: import-library job id missing')
  }
  return data.data.id
}
