import { rpc, unwrapJson } from '@/lib/rpc'
import type { FfmpegCompressOptions } from '@smm/core/whitelistedCmd/constants'

export interface FfmpegCompressParams {
  folder: string
  inputPath: string
  outputPath: string
  compressOptions: FfmpegCompressOptions
  title?: string
}

type FfmpegCompressResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['ffmpeg-compress']['$post']>>['json']>
>

type FfmpegCompressJson = Record<string, string | FfmpegCompressOptions>

/** Enqueue one-file compress via Core (`POST /api/ffmpeg-compress`). */
async function ffmpegCompress(
  params: FfmpegCompressParams,
  signal?: AbortSignal,
): Promise<FfmpegCompressResponseBody> {
  const json: FfmpegCompressJson = {
    folder: params.folder,
    inputPath: params.inputPath,
    outputPath: params.outputPath,
    compressOptions: params.compressOptions,
  }
  if (params.title?.trim()) json.title = params.title.trim()

  const resp = await rpc.api['ffmpeg-compress'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id handle. */
export async function ffmpegCompressViaCore(
  params: FfmpegCompressParams,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  const body = await ffmpegCompress(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: ffmpeg-compress job id missing')
  }
  return { id: body.data.id }
}
