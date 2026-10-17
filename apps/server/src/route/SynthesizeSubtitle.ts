import { Hono } from 'hono'
import type { SynthesizeSubtitleRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type SynthesizeSubtitleResponseBody =
  | { data: { id: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const synthesizeSubtitleRoute = new Hono().post('/api/synthesize-subtitle', async (c) => {
  try {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      /* empty body */
    }
    const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}

    const folder = optionalString(rec.folder)
    if (!folder) {
      const err: SynthesizeSubtitleResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<SynthesizeSubtitleResponseBody>(err, 200)
    }
    const videoPath = optionalString(rec.videoPath)
    if (!videoPath) {
      const err: SynthesizeSubtitleResponseBody = { error: 'Error Reason: videoPath is required' }
      return c.json<SynthesizeSubtitleResponseBody>(err, 200)
    }
    const subtitlePath = optionalString(rec.subtitlePath)
    if (!subtitlePath) {
      const err: SynthesizeSubtitleResponseBody = { error: 'Error Reason: subtitlePath is required' }
      return c.json<SynthesizeSubtitleResponseBody>(err, 200)
    }

    const request: SynthesizeSubtitleRequest = {
      folder,
      videoPath,
      subtitlePath,
      title: optionalString(rec.title),
      subtitleMode: optionalString(rec.subtitleMode) as SynthesizeSubtitleRequest['subtitleMode'],
      quality: optionalString(rec.quality) as SynthesizeSubtitleRequest['quality'],
      style: optionalString(rec.style),
      renderMode: optionalString(rec.renderMode) as SynthesizeSubtitleRequest['renderMode'],
      layout: optionalString(rec.layout) as SynthesizeSubtitleRequest['layout'],
    }

    const { id } = await getCore().synthesizeSubtitle(request)
    const ok: SynthesizeSubtitleResponseBody = { data: { id } }
    return c.json<SynthesizeSubtitleResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/synthesize-subtitle] route error')
    const err: SynthesizeSubtitleResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<SynthesizeSubtitleResponseBody>(err, 200)
  }
})
