import { apiFetch } from '@/lib/apiFetch'

export interface GetFoldersResponseBody {
  data?: { folders: string[] }
  error?: string
}

export async function getFolders(signal?: AbortSignal): Promise<GetFoldersResponseBody> {
  const resp = await apiFetch('/api/get-folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as GetFoldersResponseBody
}
