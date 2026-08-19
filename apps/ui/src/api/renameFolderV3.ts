import { apiFetch } from '@/lib/apiFetch'

export interface RenameFolderV3Params {
  from: string
  to: string
}

export interface RenameFolderV3ResponseBody {
  data?: { from: string; to: string }
  error?: string
}

/** Layer-2 rename via Core (`POST /api/rename-folder`). Used when SMM v3 is enabled. */
export async function renameFolderV3(
  params: RenameFolderV3Params,
  signal?: AbortSignal,
): Promise<RenameFolderV3ResponseBody> {
  const resp = await apiFetch('/api/rename-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: params.from, to: params.to }),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as RenameFolderV3ResponseBody
}

/** Throws on business error. */
export async function renameFolderViaCore(params: RenameFolderV3Params): Promise<void> {
  const data = await renameFolderV3(params)
  if (data.error) {
    throw new Error(data.error)
  }
}
