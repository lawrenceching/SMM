import type { GetJobOutput, JobToolPayload } from '../types/ai-tools/getJob'

export function getJobSucceeded(job: JobToolPayload): GetJobOutput {
  return { job }
}

export function getJobFailed(error: string): GetJobOutput {
  return { error }
}
