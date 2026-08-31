import { apiFetch } from '@/lib/apiFetch'

export interface ScrapeFolderV3Params {
  path: string
  language?: string
}

export interface ScrapeFolderV3ResponseBody {
  data?: { id: string }
  error?: string
}

/** Layer-2 scrape via Core (`POST /api/scrape`). */
export async function scrapeFolderV3(
  params: ScrapeFolderV3Params,
  signal?: AbortSignal,
): Promise<ScrapeFolderV3ResponseBody> {
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

  return (await resp.json()) as ScrapeFolderV3ResponseBody
}

/** Throws on business error; returns job id. */
export async function scrapeFolderViaCore(params: ScrapeFolderV3Params): Promise<string> {
  const data = await scrapeFolderV3(params)
  if (data.error) {
    throw new Error(data.error)
  }
  if (!data.data?.id) {
    throw new Error('Error Reason: scrape job id missing')
  }
  return data.data.id
}
