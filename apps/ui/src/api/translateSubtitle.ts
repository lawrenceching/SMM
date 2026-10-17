import { rpc, unwrapJson } from '@/lib/rpc'

export interface TranslateSubtitleParams {
  folder: string
  subtitlePath: string
  translator: 'bing' | 'google' | 'llm'
  targetLanguage: string
  mediaPath?: string
  title?: string
  reflect?: boolean
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  llm?: {
    apiKey: string
    apiBase?: string
    model?: string
  }
}

type TranslateSubtitleResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['translate-subtitle']['$post']>>['json']>
>

/** Enqueue one-file translate via Core (`POST /api/translate-subtitle`). */
async function translateSubtitle(
  params: TranslateSubtitleParams,
  signal?: AbortSignal,
): Promise<TranslateSubtitleResponseBody> {
  const json: Record<string, string | boolean | { apiKey: string; apiBase?: string; model?: string }> = {
    folder: params.folder,
    subtitlePath: params.subtitlePath,
    translator: params.translator,
    targetLanguage: params.targetLanguage,
  }
  if (params.mediaPath?.trim()) json.mediaPath = params.mediaPath.trim()
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.reflect !== undefined) json.reflect = params.reflect
  if (params.layout?.trim()) json.layout = params.layout.trim()
  if (params.llm?.apiKey?.trim()) {
    json.llm = {
      apiKey: params.llm.apiKey.trim(),
      ...(params.llm.apiBase?.trim() ? { apiBase: params.llm.apiBase.trim() } : {}),
      ...(params.llm.model?.trim() ? { model: params.llm.model.trim() } : {}),
    }
  }

  const resp = await rpc.api['translate-subtitle'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id. */
export async function translateSubtitleViaCore(
  params: TranslateSubtitleParams,
  signal?: AbortSignal,
): Promise<string> {
  const body = await translateSubtitle(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: translate-subtitle job id missing')
  }
  return body.data.id
}
