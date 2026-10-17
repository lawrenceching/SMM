import { Hono } from 'hono'
import type { TranscribeSubtitleRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type TranscribeSubtitleResponseBody =
  | { data: { id: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean') return undefined
  return value
}

export const transcribeSubtitleRoute = new Hono().post('/api/transcribe-subtitle', async (c) => {
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
      const err: TranscribeSubtitleResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<TranscribeSubtitleResponseBody>(err, 200)
    }
    const mediaPath = optionalString(rec.mediaPath)
    if (!mediaPath) {
      const err: TranscribeSubtitleResponseBody = { error: 'Error Reason: mediaPath is required' }
      return c.json<TranscribeSubtitleResponseBody>(err, 200)
    }
    const asr = optionalString(rec.asr)
    if (!asr) {
      const err: TranscribeSubtitleResponseBody = { error: 'Error Reason: asr is required' }
      return c.json<TranscribeSubtitleResponseBody>(err, 200)
    }

    const request: TranscribeSubtitleRequest = {
      folder,
      mediaPath,
      asr: asr as TranscribeSubtitleRequest['asr'],
      title: optionalString(rec.title),
      language: optionalString(rec.language),
      wordTimestamps: optionalBoolean(rec.wordTimestamps),
      format: optionalString(rec.format) as TranscribeSubtitleRequest['format'],
    }

    const { id } = await getCore().transcribeSubtitle(request)
    const ok: TranscribeSubtitleResponseBody = { data: { id } }
    return c.json<TranscribeSubtitleResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/transcribe-subtitle] route error')
    const err: TranscribeSubtitleResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<TranscribeSubtitleResponseBody>(err, 200)
  }
})
