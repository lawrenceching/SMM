import {
  ImportFolderJob,
  ImportLibraryJob,
  ScrapeJob,
  TranscribeSubtitleJob,
  TranslateSubtitleJob,
  YtdlpJob,
  type Job,
} from '@smm/core'
import type { getCore } from '../core/getCore'

export type GetJobData =
  | Job
  | {
      id: string
      type: string
      status: string
      progress: number
      logFilePath: string
    }

export function serializeJob(
  job: NonNullable<ReturnType<ReturnType<typeof getCore>['getJob']>>,
): GetJobData {
  if (job instanceof ScrapeJob) {
    return job.toJSON()
  }
  if (job instanceof ImportFolderJob) {
    return job.toJSON()
  }
  if (job instanceof ImportLibraryJob) {
    return job.toJSON()
  }
  if (job instanceof YtdlpJob) {
    return job.toJSON()
  }
  if (job instanceof TranscribeSubtitleJob) {
    return job.toJSON()
  }
  if (job instanceof TranslateSubtitleJob) {
    return job.toJSON()
  }
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress(),
    logFilePath: job.logFilePath,
  }
}
