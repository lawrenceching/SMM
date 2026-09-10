import { apiFetch } from '@/lib/apiFetch'
import type { FolderType } from '@smm/types'

export interface ImportFolderParams {
  path: string
  type: FolderType | 'anime'
  skipInit?: boolean
  /** Correlates client logs for import-folder flow. */
  traceId?: string
}

interface ImportFolderResponseBody {
  data?: { id: string }
  error?: string
}

/** Layer-2 import folder via Core (`POST /api/import-folder`). */
async function importFolder(
  params: ImportFolderParams,
  signal?: AbortSignal,
): Promise<ImportFolderResponseBody> {
  const { traceId, path, type, skipInit } = params
  const body: Record<string, string | boolean> = {
    path,
    type,
  }
  if (skipInit === true) {
    body.skipInit = true
  }

  if (traceId) {
    console.log(`[${traceId}] import-folder: POST /api/import-folder`, { path, type, skipInit: skipInit === true })
  }

  const resp = await apiFetch('/api/import-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as ImportFolderResponseBody
  if (traceId) {
    console.log(`[${traceId}] import-folder: POST /api/import-folder response`, {
      jobId: data.data?.id,
      error: data.error,
    })
  }
  return data
}

/** Throws on business error; returns job id. */
export async function importFolderViaCore(params: ImportFolderParams): Promise<string> {
  const data = await importFolder(params)
  if (data.error) {
    throw new Error(data.error)
  }
  if (!data.data?.id) {
    throw new Error('Error Reason: import-folder job id missing')
  }
  return data.data.id
}
