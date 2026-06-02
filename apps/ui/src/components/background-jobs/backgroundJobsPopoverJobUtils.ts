import type { BackgroundJob } from '@/types/background-jobs'
import {
  isDownloadVideoJob,
  isFfmpegConvertBackgroundJob,
  isFfmpegWriteTagsBackgroundJob,
  isProcessBackgroundJob,
  isSynthesizeBackgroundJob,
  isTranscribeBackgroundJob,
  isTranslateBackgroundJob,
} from '@/types/background-jobs'

export function getJobExecutionId(job: BackgroundJob): string | undefined {
  if (isTranscribeBackgroundJob(job)) return job.data.executionId
  if (isTranslateBackgroundJob(job)) return job.data.executionId
  if (isSynthesizeBackgroundJob(job)) return job.data.executionId
  if (isProcessBackgroundJob(job)) return job.data.executionId
  if (isDownloadVideoJob(job)) return job.data.executionId
  if (isFfmpegConvertBackgroundJob(job)) return job.data.executionId
  if (isFfmpegWriteTagsBackgroundJob(job)) return job.data.executionId
  return undefined
}

export function canOpenCommandLog(job: BackgroundJob): boolean {
  if (
    !isTranscribeBackgroundJob(job) &&
    !isTranslateBackgroundJob(job) &&
    !isSynthesizeBackgroundJob(job) &&
    !isProcessBackgroundJob(job) &&
    !isDownloadVideoJob(job) &&
    !isFfmpegConvertBackgroundJob(job) &&
    !isFfmpegWriteTagsBackgroundJob(job)
  ) {
    return false
  }
  const id = getJobExecutionId(job)
  return typeof id === 'string' && id.length > 0
}
