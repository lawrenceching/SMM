import { rpc, unwrapJson } from '@/lib/rpc'
import type { FolderType } from '@smm/types'

export interface ImportLibraryParams {
  path: string
  type: FolderType | 'anime'
  skipInit?: boolean
  /** Correlates client logs for import-library flow. */
  traceId?: string
}

type ImportLibraryResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['import-library']['$post']>>['json']>
>

/** Layer-2 import library via Core (`POST /api/import-library`). */
async function importLibrary(
  params: ImportLibraryParams,
  signal?: AbortSignal,
): Promise<ImportLibraryResponseBody> {
  const { traceId, path, type, skipInit } = params
  const body: Record<string, string | boolean> = {
    path,
    type,
  }
  if (skipInit === true) {
    body.skipInit = true
  }

  if (traceId) {
    console.log(`[${traceId}] import-library: POST /api/import-library`, { path, type, skipInit: skipInit === true })
  }

  const resp = await rpc.api['import-library'].$post({ json: body }, { init: { signal } })
  const data = await unwrapJson(resp)
  if (traceId) {
    console.log(`[${traceId}] import-library: POST /api/import-library response`, {
      jobId: 'error' in data ? undefined : data.data.id,
      error: 'error' in data ? data.error : undefined,
    })
  }
  return data
}

/** Throws on business error; returns job id. */
export async function importLibraryViaCore(params: ImportLibraryParams): Promise<string> {
  const data = await importLibrary(params)
  if ('error' in data) {
    throw new Error(data.error)
  }
  if (!data.data.id) {
    throw new Error('Error Reason: import-library job id missing')
  }
  return data.data.id
}
