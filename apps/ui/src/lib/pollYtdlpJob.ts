import { getJobViaCore, type Job, type JobStatus } from "@/api/getJob"
import { isJobTerminalStatus } from "@/hooks/useJobQuery"

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type YtdlpCoreJob = Extract<Job, { kind: "ytdlp" }>

/**
 * Poll Core `get-job` until a ytdlp download job reaches a terminal status.
 */
export async function pollYtdlpJob(
  jobId: string,
  onUpdate?: (job: YtdlpCoreJob) => void,
  signal?: AbortSignal,
): Promise<YtdlpCoreJob> {
  for (;;) {
    const job = await getJobViaCore(jobId, signal)
    if (!("kind" in job) || job.kind !== "ytdlp") {
      throw new Error(
        `Error Reason: unexpected job kind: ${"kind" in job ? job.kind : "undefined"}`,
      )
    }
    onUpdate?.(job)
    if (isJobTerminalStatus(job.status as JobStatus)) {
      return job
    }
    await sleep(POLL_INTERVAL_MS)
  }
}
