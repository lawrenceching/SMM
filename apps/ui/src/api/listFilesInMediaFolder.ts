import type { ListFilesInMediaFolderToolOutput } from '@core/types/ai-tools/listFilesInMediaFolder'
import { apiFetch } from '@/lib/apiFetch';

export interface ListFilesInMediaFolderRequest {
  mediaFolderPath: string
  recursively?: boolean
  videoFileOnly?: boolean
}

export async function listFilesInMediaFolder(
  params: ListFilesInMediaFolderRequest,
  signal?: AbortSignal,
): Promise<ListFilesInMediaFolderToolOutput> {
  const resp = await apiFetch('/api/listFilesInMediaFolder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!resp.ok) {
    throw new Error(
      `listFilesInMediaFolder: HTTP ${resp.status} ${resp.statusText}`,
    )
  }

  return (await resp.json()) as ListFilesInMediaFolderToolOutput
}
