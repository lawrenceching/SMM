import { Hono } from 'hono'
import type { InspectVideoRequest, ListSubtitleLanguagesResult } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type YtdlpListSubsResponseBody =
  | { data: ListSubtitleLanguagesResult }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const ytdlpListSubsRoute = new Hono().post('/api/ytdlp-list-subs', async (c) => {
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
      const err: YtdlpListSubsResponseBody = { error: 'Error Reason: url is required' }
      return c.json<YtdlpListSubsResponseBody>(err, 200)
    }

    const request: InspectVideoRequest = {
      url,
      cookiesText: optionalString(rec.cookiesText),
      cookiesFromBrowser: optionalString(rec.cookiesFromBrowser),
      jsRuntime: optionalString(rec.jsRuntime),
      jsRuntimePath: optionalString(rec.jsRuntimePath),
      proxy: optionalString(rec.proxy),
      potProviderUrl: optionalString(rec.potProviderUrl),
    }

    const data = await getCore().listSubtitleLanguages(request)
    const ok: YtdlpListSubsResponseBody = { data }
    return c.json<YtdlpListSubsResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/ytdlp-list-subs] route error')
    const err: YtdlpListSubsResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<YtdlpListSubsResponseBody>(err, 200)
  }
})
