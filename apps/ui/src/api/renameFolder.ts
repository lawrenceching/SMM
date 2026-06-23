import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@core/types'
import { apiFetch } from '@/lib/apiFetch';

export interface RenameFolderParams {
  from: string
  to: string
}

export async function postRenameFolder(
  params: RenameFolderParams,
): Promise<FolderRenameResponseBody> {
  const req: FolderRenameRequestBody = {
    from: params.from,
    to: params.to,
  }

  const resp = await apiFetch('/api/renameFolder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })

  if (!resp.ok) {
    return {
      error: `Failed to rename folder: ${resp.statusText}`,
    }
  }

  return (await resp.json()) as FolderRenameResponseBody
}

/** Throws on HTTP or business error — for mutations and dialogs. */
export async function renameFolder(
  params: RenameFolderParams,
): Promise<FolderRenameResponseBody> {
  const data = await postRenameFolder(params)
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}
