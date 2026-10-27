import { rpc, unwrapJson } from '@/lib/rpc'
import type { DownloadSubtitleLang } from '@smm/core'

export interface DownloadVideoParams {
  url: string
  folder: string
  title?: string
  format?: string
  extraArgs?: string[]
  subtitleLangs?: DownloadSubtitleLang[]
  cookiesText?: string
  cookiesFromBrowser?: string
  jsRuntime?: string
  jsRuntimePath?: string
  proxy?: string
  potProviderUrl?: string
}

type DownloadVideoResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['download-video']['$post']>>['json']>
>

/** Enqueue one URL download via Core (`POST /api/download-video`). */
async function downloadVideo(
  params: DownloadVideoParams,
  signal?: AbortSignal,
): Promise<DownloadVideoResponseBody> {
  const json: Record<string, string | string[] | DownloadSubtitleLang[]> = {
    url: params.url,
    folder: params.folder,
  }
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.format?.trim()) json.format = params.format.trim()
  if (params.extraArgs && params.extraArgs.length > 0) json.extraArgs = params.extraArgs
  if (params.subtitleLangs && params.subtitleLangs.length > 0) {
    json.subtitleLangs = params.subtitleLangs
  }
  if (params.cookiesText?.trim()) json.cookiesText = params.cookiesText.trim()
  if (params.cookiesFromBrowser?.trim()) {
    json.cookiesFromBrowser = params.cookiesFromBrowser.trim()
  }
  if (params.jsRuntime?.trim()) json.jsRuntime = params.jsRuntime.trim()
  if (params.jsRuntimePath?.trim()) json.jsRuntimePath = params.jsRuntimePath.trim()
  if (params.proxy?.trim()) json.proxy = params.proxy.trim()
  if (params.potProviderUrl?.trim()) json.potProviderUrl = params.potProviderUrl.trim()

  const resp = await rpc.api['download-video'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id. */
export async function downloadVideoViaCore(
  params: DownloadVideoParams,
  signal?: AbortSignal,
): Promise<string> {
  const body = await downloadVideo(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: download-video job id missing')
  }
  return body.data.id
}
