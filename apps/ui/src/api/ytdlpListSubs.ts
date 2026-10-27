import { rpc, unwrapJson } from '@/lib/rpc'
import type { DownloadSubtitleLang, SubtitleLanguage } from '@smm/core'

export interface ListSubtitleLanguagesParams {
  url: string
  cookiesText?: string
  cookiesFromBrowser?: string
  jsRuntime?: string
  jsRuntimePath?: string
  proxy?: string
  potProviderUrl?: string
}

export interface ListSubtitleLanguagesResult {
  languages: SubtitleLanguage[]
}

type ListSubtitleLanguagesResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['ytdlp-list-subs']['$post']>>['json']>
>

/** List subtitle languages via Core (`POST /api/ytdlp-list-subs`). */
async function listSubtitleLanguages(
  params: ListSubtitleLanguagesParams,
  signal?: AbortSignal,
): Promise<ListSubtitleLanguagesResponseBody> {
  const json: Record<string, string> = { url: params.url }
  if (params.cookiesText?.trim()) json.cookiesText = params.cookiesText.trim()
  if (params.cookiesFromBrowser?.trim()) {
    json.cookiesFromBrowser = params.cookiesFromBrowser.trim()
  }
  if (params.jsRuntime?.trim()) json.jsRuntime = params.jsRuntime.trim()
  if (params.jsRuntimePath?.trim()) json.jsRuntimePath = params.jsRuntimePath.trim()
  if (params.proxy?.trim()) json.proxy = params.proxy.trim()
  if (params.potProviderUrl?.trim()) json.potProviderUrl = params.potProviderUrl.trim()

  const resp = await rpc.api['ytdlp-list-subs'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns available subtitle languages. */
export async function listSubtitleLanguagesViaCore(
  params: ListSubtitleLanguagesParams,
  signal?: AbortSignal,
): Promise<ListSubtitleLanguagesResult> {
  const body = await listSubtitleLanguages(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data as ListSubtitleLanguagesResult
}

export type { DownloadSubtitleLang, SubtitleLanguage }
