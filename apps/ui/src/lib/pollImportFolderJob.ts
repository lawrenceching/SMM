import { getJobViaCore, type Job, type JobStatus } from "@/api/getJob"
import { isJobTerminalStatus } from "@/hooks/useJobQuery"

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type ImportFolderJob = Extract<Job, { kind: "import" }>

/**
 * Poll Core `get-job` until a single-folder import job reaches a terminal status.
 */
export async function pollImportFolderJob(
  jobId: string,
  onUpdate?: (job: ImportFolderJob) => void,
  signal?: AbortSignal,
): Promise<ImportFolderJob> {
  for (;;) {
    const job = await getJobViaCore(jobId, signal)
    if (!('kind' in job) || job.kind !== "import") {
      throw new Error(
        `Error Reason: unexpected job kind: ${'kind' in job ? job.kind : 'undefined'}`,
      )
    }
    onUpdate?.(job)
    if (isJobTerminalStatus(job.status as JobStatus)) {
      return job
    }
    await sleep(POLL_INTERVAL_MS)
  }
}
