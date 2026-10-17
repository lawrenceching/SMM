import { rpc, unwrapJson } from '@/lib/rpc'

export interface TranscribeSubtitleParams {
  folder: string
  mediaPath: string
  asr: 'bijian' | 'jianying' | 'whisper-cpp'
  title?: string
  language?: string
  wordTimestamps?: boolean
  format?: 'srt' | 'ass' | 'txt' | 'json'
}

type TranscribeSubtitleResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['transcribe-subtitle']['$post']>>['json']>
>

/** Enqueue one-file transcribe via Core (`POST /api/transcribe-subtitle`). */
async function transcribeSubtitle(
  params: TranscribeSubtitleParams,
  signal?: AbortSignal,
): Promise<TranscribeSubtitleResponseBody> {
  const json: Record<string, string | boolean> = {
    folder: params.folder,
    mediaPath: params.mediaPath,
    asr: params.asr,
  }
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.language?.trim()) json.language = params.language.trim()
  if (params.wordTimestamps !== undefined) json.wordTimestamps = params.wordTimestamps
  if (params.format?.trim()) json.format = params.format.trim()

  const resp = await rpc.api['transcribe-subtitle'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id. */
export async function transcribeSubtitleViaCore(
  params: TranscribeSubtitleParams,
  signal?: AbortSignal,
): Promise<string> {
  const body = await transcribeSubtitle(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: transcribe-subtitle job id missing')
  }
  return body.data.id
}
