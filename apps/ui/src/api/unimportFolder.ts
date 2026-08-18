import { apiFetch } from '@/lib/apiFetch'

export interface UnimportFolderResponseBody {
  data?: { path: string }
  error?: string
}

export async function unimportFolder(
  path: string,
  signal?: AbortSignal,
): Promise<UnimportFolderResponseBody> {
  const resp = await apiFetch('/api/unimport-folder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as UnimportFolderResponseBody
}
