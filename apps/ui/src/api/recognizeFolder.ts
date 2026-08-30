import { apiFetch } from '@/lib/apiFetch'

export type RecognizeFolderDb = 'tmdb' | 'tvdb'

export interface RecognizeFolderParams {
  path: string
  db: RecognizeFolderDb
  id: string
}

export interface RecognizeFolderResponseBody {
  data?: { path: string }
  error?: string
}

/** `POST /api/recognize-folder` → `Core.recognizeFolder`. */
export async function recognizeFolder(
  params: RecognizeFolderParams,
  signal?: AbortSignal,
): Promise<RecognizeFolderResponseBody> {
  const resp = await apiFetch('/api/recognize-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as RecognizeFolderResponseBody
}

/** Throws on business error. */
export async function recognizeFolderViaCore(params: RecognizeFolderParams): Promise<void> {
  const body = await recognizeFolder(params)
  if (body.error) {
    throw new Error(body.error)
  }
}
