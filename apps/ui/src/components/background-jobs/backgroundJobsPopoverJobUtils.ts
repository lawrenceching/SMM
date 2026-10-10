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

/** Command-log correlation id when the job was started via executeCmd. */
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
