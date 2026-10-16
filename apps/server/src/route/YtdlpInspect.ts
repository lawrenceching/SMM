import { Hono } from 'hono'
import type { InspectVideoRequest, InspectVideoResult } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type YtdlpInspectResponseBody =
  | { data: InspectVideoResult }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const ytdlpInspectRoute = new Hono().post('/api/ytdlp-inspect', async (c) => {
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
      const err: YtdlpInspectResponseBody = { error: 'Error Reason: url is required' }
      return c.json<YtdlpInspectResponseBody>(err, 200)
    }

    const request: InspectVideoRequest = {
      url,
      cookiesText: optionalString(rec.cookiesText),
      cookiesFromBrowser: optionalString(rec.cookiesFromBrowser),
      jsRuntime: optionalString(rec.jsRuntime),
      jsRuntimePath: optionalString(rec.jsRuntimePath),
      proxy: optionalString(rec.proxy),
    }

    const data = await getCore().inspectVideo(request)
    const ok: YtdlpInspectResponseBody = { data }
    return c.json<YtdlpInspectResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/ytdlp-inspect] route error')
    const err: YtdlpInspectResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<YtdlpInspectResponseBody>(err, 200)
  }
})
