import { Path } from '@core/path'
import type {
  FfmpegCompressOptions,
  FfmpegCompressContainer,
} from '@core/whitelistedCmd/constants'
import type {
  FfmpegCompressBackgroundJob,
  FfmpegCompressBackgroundJobData,
} from '@/types/ffmpegCompressJob'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Map a UI container choice to the corresponding opaque FfmpegConvertFormat token. */
export function compressContainerToFormat(
  container: FfmpegCompressContainer,
): 'compress-mp4' | 'compress-mkv' | 'compress-webm' | 'compress-mov' {
  switch (container) {
    case 'mp4':
      return 'compress-mp4'
    case 'mkv':
      return 'compress-mkv'
    case 'webm':
      return 'compress-webm'
    case 'mov':
      return 'compress-mov'
  }
}

export interface BuildFfmpegCompressJobInput {
  folder?: string
  inputPath: string
  outputPath: string
  outputContainer: FfmpegCompressContainer
  compressOptions: FfmpegCompressOptions
  title: string
}

export function buildFfmpegCompressJob(
  input: BuildFfmpegCompressJobInput,
): FfmpegCompressBackgroundJob {
  const inputPathPosix = Path.posix(input.inputPath)
  const inputPathPlatform = Path.toPlatformPath(inputPathPosix)
  const outputPathPosix = Path.posix(input.outputPath)
  const outputPathPlatform = Path.toPlatformPath(outputPathPosix)
  const name = `Compress: ${input.title.trim() || inputPathPosix}`

  const data: FfmpegCompressBackgroundJobData = {
    folder: input.folder ?? '',
    inputPath: inputPathPosix,
    inputPathPlatform,
    outputPath: outputPathPosix,
    outputPathPlatform,
    outputFormat: compressContainerToFormat(input.outputContainer),
    preset: 'compress',
    compressOptions: input.compressOptions,
    title: input.title.trim() || inputPathPosix,
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
