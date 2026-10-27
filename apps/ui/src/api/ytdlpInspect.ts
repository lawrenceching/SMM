import { rpc, unwrapJson } from '@/lib/rpc'
import type { VideoMetadata } from '@/api/ytdlp/types'

export interface YtdlpInspectParams {
  url: string
  cookiesText?: string
  cookiesFromBrowser?: string
  jsRuntime?: string
  jsRuntimePath?: string
  proxy?: string
  potProviderUrl?: string
}

type YtdlpInspectResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['ytdlp-inspect']['$post']>>['json']>
>

export interface YtdlpInspectResult {
  video: VideoMetadata
  playlistEntries?: VideoMetadata[]
}

/** Probe formats / playlist via Core (`POST /api/ytdlp-inspect`). */
async function ytdlpInspect(
  params: YtdlpInspectParams,
  signal?: AbortSignal,
): Promise<YtdlpInspectResponseBody> {
  const json: Record<string, string> = { url: params.url }
  if (params.cookiesText?.trim()) json.cookiesText = params.cookiesText.trim()
  if (params.cookiesFromBrowser?.trim()) {
    json.cookiesFromBrowser = params.cookiesFromBrowser.trim()
  }
  if (params.jsRuntime?.trim()) json.jsRuntime = params.jsRuntime.trim()
  if (params.jsRuntimePath?.trim()) json.jsRuntimePath = params.jsRuntimePath.trim()
  if (params.proxy?.trim()) json.proxy = params.proxy.trim()
  if (params.potProviderUrl?.trim()) json.potProviderUrl = params.potProviderUrl.trim()

  const resp = await rpc.api['ytdlp-inspect'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns inspect payload. */
export async function ytdlpInspectViaCore(
  params: YtdlpInspectParams,
  signal?: AbortSignal,
): Promise<YtdlpInspectResult> {
  const body = await ytdlpInspect(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data as YtdlpInspectResult
}
