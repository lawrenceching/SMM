import { Path } from '@core/path'
import type { FfmpegConvertBackgroundJob, FfmpegConvertBackgroundJobData } from '@/types/background-jobs'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

import type { FfmpegConvertImageOptions } from '@core/whitelistedCmd/constants'

export interface BuildFfmpegConvertJobInput {
  folder?: string
  inputPath: string
  outputPath: string
  outputFormat: string
  preset: string
  title: string
  imageOptions?: FfmpegConvertImageOptions
}

export function buildFfmpegConvertJob(
  input: BuildFfmpegConvertJobInput,
): FfmpegConvertBackgroundJob {
  const inputPathPosix = Path.posix(input.inputPath)
  const inputPathPlatform = Path.toPlatformPath(inputPathPosix)
  const outputPathPosix = Path.posix(input.outputPath)
  const outputPathPlatform = Path.toPlatformPath(outputPathPosix)
  const name = `Convert: ${input.title.trim() || inputPathPosix}`

  const data: FfmpegConvertBackgroundJobData = {
    folder: input.folder ?? '',
    inputPath: inputPathPosix,
    inputPathPlatform,
    outputPath: outputPathPosix,
    outputPathPlatform,
    outputFormat: input.outputFormat,
    preset: input.preset,
    title: input.title.trim() || inputPathPosix,
    ...(input.imageOptions && { imageOptions: input.imageOptions }),
  }

  return {
    id: newJobId(),
    name,
    status: 'pending',
    progress: 0,
    type: 'ffmpeg-convert',
    data,
  }
}
