import { Hono } from 'hono'
import type { FfmpegCompressRequest } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type FfmpegCompressResponseBody =
  | { data: { id: string } }
  | { error: string }

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optionalCompressOptions(
  value: unknown,
): FfmpegCompressRequest['compressOptions'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as FfmpegCompressRequest['compressOptions']
}

export const ffmpegCompressRoute = new Hono().post('/api/ffmpeg-compress', async (c) => {
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
      const err: FfmpegCompressResponseBody = { error: 'Error Reason: folder is required' }
      return c.json<FfmpegCompressResponseBody>(err, 200)
    }
    const inputPath = optionalString(rec.inputPath)
    if (!inputPath) {
      const err: FfmpegCompressResponseBody = { error: 'Error Reason: inputPath is required' }
      return c.json<FfmpegCompressResponseBody>(err, 200)
    }
    const outputPath = optionalString(rec.outputPath)
    if (!outputPath) {
      const err: FfmpegCompressResponseBody = { error: 'Error Reason: outputPath is required' }
      return c.json<FfmpegCompressResponseBody>(err, 200)
    }
    const compressOptions = optionalCompressOptions(rec.compressOptions)
    if (!compressOptions) {
      const err: FfmpegCompressResponseBody = { error: 'Error Reason: compressOptions is required' }
      return c.json<FfmpegCompressResponseBody>(err, 200)
    }

    const request: FfmpegCompressRequest = {
      folder,
      inputPath,
      outputPath,
      compressOptions,
      title: optionalString(rec.title),
    }

    const { id } = await getCore().ffmpegCompress(request)
    const ok: FfmpegCompressResponseBody = { data: { id } }
    return c.json<FfmpegCompressResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/ffmpeg-compress] route error')
    const err: FfmpegCompressResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<FfmpegCompressResponseBody>(err, 200)
  }
})
