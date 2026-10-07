import { rpc, unwrapJson } from '@/lib/rpc'
import type { FolderType } from '@smm/types'

export interface ImportFolderParams {
  path: string
  type: FolderType | 'anime'
  skipInit?: boolean
  /** Correlates client logs for import-folder flow. */
  traceId?: string
}

type ImportFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['import-folder']['$post']>>['json']>
>

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

  const resp = await rpc.api['import-folder'].$post({ json: body }, { init: { signal } })
  const data = await unwrapJson(resp)
  if (traceId) {
    console.log(`[${traceId}] import-folder: POST /api/import-folder response`, {
      jobId: 'error' in data ? undefined : data.data.id,
      error: 'error' in data ? data.error : undefined,
    })
  }
  return data
}

/** Throws on business error; returns job id. */
export async function importFolderViaCore(params: ImportFolderParams): Promise<string> {
  const data = await importFolder(params)
  if ('error' in data) {
    throw new Error(data.error)
  }
  if (!data.data.id) {
    throw new Error('Error Reason: import-folder job id missing')
  }
  return data.data.id
}
