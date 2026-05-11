import { Path } from '@core/path'
import type { TranscribeBackgroundJob, TranscribeBackgroundJobData } from '@/types/background-jobs'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface BuildTranscribeJobInput {
  folder: string
  mediaPath: string
  title: string
  provider: TranscribeBackgroundJobData['provider']
  videoCaptioner?: TranscribeBackgroundJobData['videoCaptioner']
  tencentAsr?: TranscribeBackgroundJobData['tencentAsr']
}

export function buildTranscribeJob(input: BuildTranscribeJobInput): TranscribeBackgroundJob {
  const mediaPathPosix = Path.posix(input.mediaPath)
  const mediaPathPlatform = Path.toPlatformPath(mediaPathPosix)
  const name = `Transcribe: ${input.title.trim() || mediaPathPosix}`
  const data: TranscribeBackgroundJobData = {
    folder: input.folder,
    mediaPath: mediaPathPosix,
    mediaPathPlatform,
    title: input.title.trim() || mediaPathPosix,
    provider: input.provider,
    ...(input.provider === 'videoCaptioner' && input.videoCaptioner !== undefined
      ? { videoCaptioner: input.videoCaptioner }
      : {}),
    ...(input.provider === 'tencentAsr' && input.tencentAsr !== undefined ? { tencentAsr: input.tencentAsr } : {}),
  }

  return {
    id: newJobId(),
    name,
    status: 'pending',
    progress: 0,
    type: 'transcribe',
    data,
  }
}
