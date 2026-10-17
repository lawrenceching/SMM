import { rpc, unwrapJson } from '@/lib/rpc'

export interface SynthesizeSubtitleParams {
  folder: string
  videoPath: string
  subtitlePath: string
  title?: string
  subtitleMode?: 'soft' | 'hard'
  quality?: 'ultra' | 'high' | 'medium' | 'low'
  style?: string
  renderMode?: 'ass' | 'rounded'
  layout?: 'target-above' | 'source-above' | 'target-only' | 'source-only'
}

type SynthesizeSubtitleResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['synthesize-subtitle']['$post']>>['json']>
>

/** Enqueue one-file synthesize via Core (`POST /api/synthesize-subtitle`). */
async function synthesizeSubtitle(
  params: SynthesizeSubtitleParams,
  signal?: AbortSignal,
): Promise<SynthesizeSubtitleResponseBody> {
  const json: Record<string, string> = {
    folder: params.folder,
    videoPath: params.videoPath,
    subtitlePath: params.subtitlePath,
  }
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.subtitleMode?.trim()) json.subtitleMode = params.subtitleMode.trim()
  if (params.quality?.trim()) json.quality = params.quality.trim()
  if (params.style?.trim()) json.style = params.style.trim()
  if (params.renderMode?.trim()) json.renderMode = params.renderMode.trim()
  if (params.layout?.trim()) json.layout = params.layout.trim()

  const resp = await rpc.api['synthesize-subtitle'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id. */
export async function synthesizeSubtitleViaCore(
  params: SynthesizeSubtitleParams,
  signal?: AbortSignal,
): Promise<string> {
  const body = await synthesizeSubtitle(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: synthesize-subtitle job id missing')
  }
  return body.data.id
}
