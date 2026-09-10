import { apiFetch } from '@/lib/apiFetch'

export interface RenameFolderParams {
  from: string
  to: string
}

export interface RenameFolderResponseBody {
  data?: { from: string; to: string }
  error?: string
}

/** `POST /api/rename-folder` → `Core.renameFolder`. */
export async function postRenameFolder(
  params: RenameFolderParams,
  signal?: AbortSignal,
): Promise<RenameFolderResponseBody> {
  const resp = await apiFetch('/api/rename-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: params.from, to: params.to }),
    signal,
  })

  if (!resp.ok) {
    return {
      error: `Failed to rename folder: ${resp.statusText}`,
    }
  }

  return (await resp.json()) as RenameFolderResponseBody
}

/** Throws on business error. */
export async function renameFolderViaCore(params: RenameFolderParams): Promise<void> {
  const data = await postRenameFolder(params)
  if (data.error) {
    throw new Error(data.error)
  }
}
