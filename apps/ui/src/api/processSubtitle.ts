import { rpc, unwrapJson } from '@/lib/rpc'

export interface ProcessSubtitleParams {
  folder: string
  mediaPath: string
  title?: string
  asr?: 'bijian' | 'jianying' | 'whisper-cpp'
  language?: string
  wordTimestamps?: boolean
  format?: 'srt' | 'ass' | 'txt' | 'json'
  noOptimize?: boolean
  noSplit?: boolean
  noTranslate?: boolean
  translator?: 'bing' | 'google' | 'llm'
  targetLanguage?: string
  reflect?: boolean
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
  prompt?: string
  /** Sent to Core HTTP only; never stored in UI Zustand job data. */
  llm?: {
    apiKey: string
    apiBase?: string
    model?: string
  }
  noSynthesize?: boolean
  subtitleMode?: 'soft' | 'hard'
  quality?: 'ultra' | 'high' | 'medium' | 'low'
  style?: string
  renderMode?: 'ass' | 'rounded'
  synthesizeLayout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
}

type ProcessSubtitleResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['process-subtitle']['$post']>>['json']>
>

type ProcessSubtitleJson = Record<
  string,
  string | boolean | { apiKey: string; apiBase?: string; model?: string }
>

/** Enqueue one-file process via Core (`POST /api/process-subtitle`). */
async function processSubtitle(
  params: ProcessSubtitleParams,
  signal?: AbortSignal,
): Promise<ProcessSubtitleResponseBody> {
  const json: ProcessSubtitleJson = {
    folder: params.folder,
    mediaPath: params.mediaPath,
  }
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.asr?.trim()) json.asr = params.asr.trim()
  if (params.language?.trim()) json.language = params.language.trim()
  if (params.wordTimestamps !== undefined) json.wordTimestamps = params.wordTimestamps
  if (params.format?.trim()) json.format = params.format.trim()
  if (params.noOptimize !== undefined) json.noOptimize = params.noOptimize
  if (params.noSplit !== undefined) json.noSplit = params.noSplit
  if (params.noTranslate !== undefined) json.noTranslate = params.noTranslate
  if (params.translator?.trim()) json.translator = params.translator.trim()
  if (params.targetLanguage?.trim()) json.targetLanguage = params.targetLanguage.trim()
  if (params.reflect !== undefined) json.reflect = params.reflect
  if (params.layout?.trim()) json.layout = params.layout.trim()
  if (params.prompt?.trim()) json.prompt = params.prompt.trim()
  if (params.llm?.apiKey?.trim()) {
    json.llm = {
      apiKey: params.llm.apiKey.trim(),
      ...(params.llm.apiBase?.trim() ? { apiBase: params.llm.apiBase.trim() } : {}),
      ...(params.llm.model?.trim() ? { model: params.llm.model.trim() } : {}),
    }
  }
  if (params.noSynthesize !== undefined) json.noSynthesize = params.noSynthesize
  if (params.subtitleMode?.trim()) json.subtitleMode = params.subtitleMode.trim()
  if (params.quality?.trim()) json.quality = params.quality.trim()
  if (params.style?.trim()) json.style = params.style.trim()
  if (params.renderMode?.trim()) json.renderMode = params.renderMode.trim()
  if (params.synthesizeLayout?.trim()) json.synthesizeLayout = params.synthesizeLayout.trim()

  const resp = await rpc.api['process-subtitle'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id. */
export async function processSubtitleViaCore(
  params: ProcessSubtitleParams,
  signal?: AbortSignal,
): Promise<string> {
  const body = await processSubtitle(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: process-subtitle job id missing')
  }
  return body.data.id
}
