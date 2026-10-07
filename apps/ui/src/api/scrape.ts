import { rpc, unwrapJson } from '@/lib/rpc'

export interface ScrapeFolderParams {
  path: string
  language?: string
}

type ScrapeFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['scrape']['$post']>>['json']>
>

/** Layer-2 scrape via Core (`POST /api/scrape`). */
export async function scrapeFolder(
  params: ScrapeFolderParams,
  signal?: AbortSignal,
): Promise<ScrapeFolderResponseBody> {
  const body: Record<string, string> = { path: params.path }
  if (params.language !== undefined && params.language.trim() !== '') {
    body.language = params.language
  }

  const resp = await rpc.api.scrape.$post({ json: body }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns job id. */
export async function scrapeFolderViaCore(params: ScrapeFolderParams): Promise<string> {
  const data = await scrapeFolder(params)
  if ('error' in data) {
    throw new Error(data.error)
  }
  if (!data.data.id) {
    throw new Error('Error Reason: scrape job id missing')
  }
  return data.data.id
}
