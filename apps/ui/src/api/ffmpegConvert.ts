import { rpc, unwrapJson } from '@/lib/rpc'
import type {
  FfmpegConvertFormat,
  FfmpegConvertImageOptions,
  FfmpegConvertPreset,
} from '@smm/core/whitelistedCmd/constants'

export interface FfmpegConvertParams {
  folder: string
  inputPath: string
  outputPath: string
  outputFormat: FfmpegConvertFormat
  preset: FfmpegConvertPreset
  title?: string
  imageOptions?: FfmpegConvertImageOptions
}

type FfmpegConvertResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['ffmpeg-convert']['$post']>>['json']>
>

type FfmpegConvertJson = Record<string, string | FfmpegConvertImageOptions>

/** Enqueue one-file convert via Core (`POST /api/ffmpeg-convert`). */
async function ffmpegConvert(
  params: FfmpegConvertParams,
  signal?: AbortSignal,
): Promise<FfmpegConvertResponseBody> {
  const json: FfmpegConvertJson = {
    folder: params.folder,
    inputPath: params.inputPath,
    outputPath: params.outputPath,
    outputFormat: params.outputFormat,
    preset: params.preset,
  }
  if (params.title?.trim()) json.title = params.title.trim()
  if (params.imageOptions) json.imageOptions = params.imageOptions

  const resp = await rpc.api['ffmpeg-convert'].$post({ json }, { init: { signal } })
  return unwrapJson(resp)
}

/** Throws on business error; returns Core job id handle. */
export async function ffmpegConvertViaCore(
  params: FfmpegConvertParams,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  const body = await ffmpegConvert(params, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  if (!body.data.id) {
    throw new Error('Error Reason: ffmpeg-convert job id missing')
  }
  return { id: body.data.id }
}
