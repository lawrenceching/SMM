import { Hono } from 'hono'
import type { ProcessSubtitleRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type ProcessSubtitleResponseBody =
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
): ProcessSubtitleRequest['llm'] | undefined {
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

export const processSubtitleRoute = new Hono().post('/api/process-subtitle', async (c) => {
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
      const err: ProcessSubtitleResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<ProcessSubtitleResponseBody>(err, 200)
    }
    const mediaPath = optionalString(rec.mediaPath)
    if (!mediaPath) {
      const err: ProcessSubtitleResponseBody = { error: 'Error Reason: mediaPath is required' }
      return c.json<ProcessSubtitleResponseBody>(err, 200)
    }

    const request: ProcessSubtitleRequest = {
      folder,
      mediaPath,
      title: optionalString(rec.title),
      asr: optionalString(rec.asr) as ProcessSubtitleRequest['asr'],
      language: optionalString(rec.language),
      wordTimestamps: optionalBoolean(rec.wordTimestamps),
      format: optionalString(rec.format) as ProcessSubtitleRequest['format'],
      noOptimize: optionalBoolean(rec.noOptimize),
      noSplit: optionalBoolean(rec.noSplit),
      noTranslate: optionalBoolean(rec.noTranslate),
      translator: optionalString(rec.translator) as ProcessSubtitleRequest['translator'],
      targetLanguage: optionalString(rec.targetLanguage),
      reflect: optionalBoolean(rec.reflect),
      layout: optionalString(rec.layout) as ProcessSubtitleRequest['layout'],
      prompt: optionalString(rec.prompt),
      llm: optionalLlm(rec.llm),
      noSynthesize: optionalBoolean(rec.noSynthesize),
      subtitleMode: optionalString(rec.subtitleMode) as ProcessSubtitleRequest['subtitleMode'],
      quality: optionalString(rec.quality) as ProcessSubtitleRequest['quality'],
      style: optionalString(rec.style),
      renderMode: optionalString(rec.renderMode) as ProcessSubtitleRequest['renderMode'],
      synthesizeLayout: optionalString(rec.synthesizeLayout) as ProcessSubtitleRequest['synthesizeLayout'],
    }

    const { id } = await getCore().processSubtitle(request)
    const ok: ProcessSubtitleResponseBody = { data: { id } }
    return c.json<ProcessSubtitleResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/process-subtitle] route error')
    const err: ProcessSubtitleResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<ProcessSubtitleResponseBody>(err, 200)
  }
})
