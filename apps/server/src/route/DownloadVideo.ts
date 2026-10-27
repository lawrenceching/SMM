import { Hono } from 'hono'
import type { DownloadSubtitleLang, DownloadVideoRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type DownloadVideoResponseBody =
  | { data: { id: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const args = value.filter((item): item is string => typeof item === 'string')
  return args.length > 0 ? args : undefined
}

function optionalSubtitleLangs(value: unknown): DownloadSubtitleLang[] | undefined {
  if (!Array.isArray(value)) return undefined
  const langs: DownloadSubtitleLang[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const code = typeof rec.code === 'string' ? rec.code.trim() : ''
    const kind = rec.kind
    if (!code) continue
    if (kind !== 'manual' && kind !== 'auto' && kind !== 'both') continue
    langs.push({ code, kind })
  }
  return langs.length > 0 ? langs : undefined
}

export const downloadVideoRoute = new Hono().post('/api/download-video', async (c) => {
  try {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      /* empty body */
    }
    const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const url = optionalString(rec.url)
    if (!url) {
      const err: DownloadVideoResponseBody = { error: 'Error Reason: url is required' }
      return c.json<DownloadVideoResponseBody>(err, 200)
    }
    const folder = optionalString(rec.folder)
    if (!folder) {
      const err: DownloadVideoResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<DownloadVideoResponseBody>(err, 200)
    }

    const request: DownloadVideoRequest = {
      url,
      folder,
      title: optionalString(rec.title),
      format: optionalString(rec.format),
      extraArgs: optionalStringArray(rec.extraArgs),
      subtitleLangs: optionalSubtitleLangs(rec.subtitleLangs),
      cookiesText: optionalString(rec.cookiesText),
      cookiesFromBrowser: optionalString(rec.cookiesFromBrowser),
      jsRuntime: optionalString(rec.jsRuntime),
      jsRuntimePath: optionalString(rec.jsRuntimePath),
      proxy: optionalString(rec.proxy),
      potProviderUrl: optionalString(rec.potProviderUrl),
    }

    const { id } = await getCore().downloadVideo(request, {})
    const ok: DownloadVideoResponseBody = { data: { id } }
    return c.json<DownloadVideoResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/download-video] route error')
    const err: DownloadVideoResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<DownloadVideoResponseBody>(err, 200)
  }
})
