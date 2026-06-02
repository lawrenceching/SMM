import { Path } from '@core/path'
import type { FfmpegWriteTagsBackgroundJob, FfmpegWriteTagsBackgroundJobData } from '@/types/background-jobs'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface BuildFfmpegWriteTagsJobInput {
  folder?: string
  filePath: string
  title: string
  tags: Record<string, string>
}

export function buildFfmpegWriteTagsJob(
  input: BuildFfmpegWriteTagsJobInput,
): FfmpegWriteTagsBackgroundJob {
  const filePathPosix = Path.posix(input.filePath)
  const filePathPlatform = Path.toPlatformPath(filePathPosix)
  const name = `Write Tags: ${input.title.trim() || filePathPosix}`

  const data: FfmpegWriteTagsBackgroundJobData = {
    folder: input.folder,
    filePath: filePathPosix,
    filePathPlatform,
    title: input.title.trim() || filePathPosix,
    tags: input.tags,
  }

  return {
    id: newJobId(),
    name,
    status: 'pending',
    progress: 0,
    type: 'ffmpeg-write-tags',
    data,
  }
}
