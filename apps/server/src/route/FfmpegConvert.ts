import { Hono } from 'hono'
import type { FfmpegConvertRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type FfmpegConvertResponseBody =
  | { data: { id: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optionalImageOptions(
  value: unknown,
): FfmpegConvertRequest['imageOptions'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as FfmpegConvertRequest['imageOptions']
}

export const ffmpegConvertRoute = new Hono().post('/api/ffmpeg-convert', async (c) => {
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
      const err: FfmpegConvertResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<FfmpegConvertResponseBody>(err, 200)
    }
    const inputPath = optionalString(rec.inputPath)
    if (!inputPath) {
      const err: FfmpegConvertResponseBody = { error: 'Error Reason: inputPath is required' }
      return c.json<FfmpegConvertResponseBody>(err, 200)
    }
    const outputPath = optionalString(rec.outputPath)
    if (!outputPath) {
      const err: FfmpegConvertResponseBody = { error: 'Error Reason: outputPath is required' }
      return c.json<FfmpegConvertResponseBody>(err, 200)
    }
    const outputFormat = optionalString(rec.outputFormat)
    if (!outputFormat) {
      const err: FfmpegConvertResponseBody = { error: 'Error Reason: outputFormat is required' }
      return c.json<FfmpegConvertResponseBody>(err, 200)
    }
    const preset = optionalString(rec.preset)
    if (!preset) {
      const err: FfmpegConvertResponseBody = { error: 'Error Reason: preset is required' }
      return c.json<FfmpegConvertResponseBody>(err, 200)
    }

    const request: FfmpegConvertRequest = {
      folder,
      inputPath,
      outputPath,
      outputFormat: outputFormat as FfmpegConvertRequest['outputFormat'],
      preset: preset as FfmpegConvertRequest['preset'],
      title: optionalString(rec.title),
      imageOptions: optionalImageOptions(rec.imageOptions),
    }

    const { id } = await getCore().ffmpegConvert(request)
    const ok: FfmpegConvertResponseBody = { data: { id } }
    return c.json<FfmpegConvertResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/ffmpeg-convert] route error')
    const err: FfmpegConvertResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<FfmpegConvertResponseBody>(err, 200)
  }
})
