import { Hono } from 'hono'
import type { TranslateSubtitleRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type TranslateSubtitleResponseBody =
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

function optionalLlm(
  value: unknown,
): TranslateSubtitleRequest['llm'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const rec = value as Record<string, unknown>
  const apiKey = optionalString(rec.apiKey)
  if (!apiKey) return undefined
  return {
    apiKey,
    apiBase: optionalString(rec.apiBase),
    model: optionalString(rec.model),
  }
}

export const translateSubtitleRoute = new Hono().post('/api/translate-subtitle', async (c) => {
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
      const err: TranslateSubtitleResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<TranslateSubtitleResponseBody>(err, 200)
    }
    const subtitlePath = optionalString(rec.subtitlePath)
    if (!subtitlePath) {
      const err: TranslateSubtitleResponseBody = { error: 'Error Reason: subtitlePath is required' }
      return c.json<TranslateSubtitleResponseBody>(err, 200)
    }
    const translator = optionalString(rec.translator)
    if (!translator) {
      const err: TranslateSubtitleResponseBody = { error: 'Error Reason: translator is required' }
      return c.json<TranslateSubtitleResponseBody>(err, 200)
    }
    const targetLanguage = optionalString(rec.targetLanguage)
    if (!targetLanguage) {
      const err: TranslateSubtitleResponseBody = { error: 'Error Reason: targetLanguage is required' }
      return c.json<TranslateSubtitleResponseBody>(err, 200)
    }

    const request: TranslateSubtitleRequest = {
      folder,
      subtitlePath,
      translator: translator as TranslateSubtitleRequest['translator'],
      targetLanguage,
      mediaPath: optionalString(rec.mediaPath),
      title: optionalString(rec.title),
      reflect: optionalBoolean(rec.reflect),
      layout: optionalString(rec.layout) as TranslateSubtitleRequest['layout'],
      llm: optionalLlm(rec.llm),
    }

    const { id } = await getCore().translateSubtitle(request)
    const ok: TranslateSubtitleResponseBody = { data: { id } }
    return c.json<TranslateSubtitleResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/translate-subtitle] route error')
    const err: TranslateSubtitleResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<TranslateSubtitleResponseBody>(err, 200)
  }
})
