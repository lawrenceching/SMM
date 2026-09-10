import { apiFetch } from '@/lib/apiFetch'

export interface ScrapeFolderParams {
  path: string
  language?: string
}

export interface ScrapeFolderResponseBody {
  data?: { id: string }
  error?: string
}

/** Layer-2 scrape via Core (`POST /api/scrape`). */
export async function scrapeFolder(
  params: ScrapeFolderParams,
  signal?: AbortSignal,
): Promise<ScrapeFolderResponseBody> {
  const body: Record<string, string> = { path: params.path }
  if (params.language !== undefined && params.language.trim() !== '') {
    body.language = params.language
  }

  const resp = await apiFetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as ScrapeFolderResponseBody
}

/** Throws on business error; returns job id. */
export async function scrapeFolderViaCore(params: ScrapeFolderParams): Promise<string> {
  const data = await scrapeFolder(params)
  if (data.error) {
    throw new Error(data.error)
  }
  if (!data.data?.id) {
    throw new Error('Error Reason: scrape job id missing')
  }
  return data.data.id
}
