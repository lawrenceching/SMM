import { getJobViaCore, type Job, type JobStatus } from "@/api/getJob"
import { isJobTerminalStatus } from "@/hooks/useJobQuery"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import type {
  CoreFfmpegCompressBackgroundJob,
  CoreFfmpegConvertBackgroundJob,
  JobStatus as StoreJobStatus,
} from "@/types/background-jobs"
import type {
  FfmpegCompressOptions,
  FfmpegConvertImageOptions,
} from "@smm/core/whitelistedCmd/constants"

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type FfmpegCoreJobKind = "ffmpeg-convert" | "ffmpeg-compress"
export type FfmpegConvertCoreJob = Extract<Job, { kind: "ffmpeg-convert" }>
export type FfmpegCompressCoreJob = Extract<Job, { kind: "ffmpeg-compress" }>

function toJobStatus(status: string): StoreJobStatus {
  if (
    status === "pending" ||
    status === "running" ||
    status === "failed" ||
    status === "succeeded" ||
    status === "aborted" ||
    status === "stopped"
  ) {
    return status
  }
  return "running"
}

/**
 * Poll Core `get-job` until an ffmpeg convert/compress job reaches a terminal status.
 */
export async function pollFfmpegJob<K extends FfmpegCoreJobKind>(
  jobId: string,
  expectedKind: K,
  onUpdate?: (job: Extract<Job, { kind: K }>) => void,
  signal?: AbortSignal,
): Promise<Extract<Job, { kind: K }>> {
  for (;;) {
    const job = await getJobViaCore(jobId, signal)
    if (!("kind" in job) || job.kind !== expectedKind) {
      throw new Error(
        `Error Reason: unexpected job kind: ${"kind" in job ? job.kind : "undefined"}`,
      )
    }
    onUpdate?.(job as Extract<Job, { kind: K }>)
    if (isJobTerminalStatus(job.status as JobStatus)) {
      return job as Extract<Job, { kind: K }>
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

export function upsertFfmpegConvertJobFromCore(params: {
  id: string
  folder: string
  inputPath: string
  outputPath: string
  outputFormat: string
  preset: string
  title?: string
  imageOptions?: FfmpegConvertImageOptions
  status?: StoreJobStatus
  progress?: number
  etaSeconds?: number | null
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: CoreFfmpegConvertBackgroundJob = {
    id: params.id,
    name: `Convert: ${params.title?.trim() || params.inputPath}`,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "ffmpeg-convert",
    data: {
      folder: params.folder,
      inputPath: params.inputPath,
      outputPath: params.outputPath,
      outputFormat: params.outputFormat,
      preset: params.preset,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      ...(params.imageOptions ? { imageOptions: params.imageOptions } : {}),
      ...(params.etaSeconds !== undefined ? { etaSeconds: params.etaSeconds } : {}),
      ...(params.error ? { error: params.error } : {}),
      logRelativePath: `job-${params.id}.log`,
    },
  }
  if (existing) {
    useBackgroundJobsStore.getState().updateJob(params.id, {
      name: next.name,
      status: next.status,
      progress: next.progress,
      data: next.data,
    })
  } else {
    useBackgroundJobsStore.getState().addJob(next)
  }
}

export function upsertFfmpegCompressJobFromCore(params: {
  id: string
  folder: string
  inputPath: string
  outputPath: string
  compressOptions: FfmpegCompressOptions
  title?: string
  status?: StoreJobStatus
  progress?: number
  etaSeconds?: number | null
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: CoreFfmpegCompressBackgroundJob = {
    id: params.id,
    name: `Compress: ${params.title?.trim() || params.inputPath}`,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "ffmpeg-compress",
    data: {
      folder: params.folder,
      inputPath: params.inputPath,
      outputPath: params.outputPath,
      compressOptions: params.compressOptions,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      ...(params.etaSeconds !== undefined ? { etaSeconds: params.etaSeconds } : {}),
      ...(params.error ? { error: params.error } : {}),
      logRelativePath: `job-${params.id}.log`,
    },
  }
  if (existing) {
    useBackgroundJobsStore.getState().updateJob(params.id, {
      name: next.name,
      status: next.status,
      progress: next.progress,
      data: next.data,
    })
  } else {
    useBackgroundJobsStore.getState().addJob(next)
  }
}

export function applyFfmpegConvertPollUpdate(job: FfmpegConvertCoreJob): void {
  upsertFfmpegConvertJobFromCore({
    id: job.id,
    folder: job.folder,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    outputFormat: job.outputFormat,
    preset: job.preset,
    title: job.title,
    imageOptions: job.imageOptions,
    status: toJobStatus(job.status),
    progress: job.progress,
    etaSeconds: job.etaSeconds,
    error: job.error,
  })
}

export function applyFfmpegCompressPollUpdate(job: FfmpegCompressCoreJob): void {
  upsertFfmpegCompressJobFromCore({
    id: job.id,
    folder: job.folder,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    compressOptions: job.compressOptions,
    title: job.title,
    status: toJobStatus(job.status),
    progress: job.progress,
    etaSeconds: job.etaSeconds,
    error: job.error,
  })
}
