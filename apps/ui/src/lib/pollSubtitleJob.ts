import { getJobViaCore, type Job, type JobStatus } from "@/api/getJob"
import { isJobTerminalStatus } from "@/hooks/useJobQuery"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import type {
  JobStatus as StoreJobStatus,
  ProcessSubtitleBackgroundJob,
  SynthesizeSubtitleBackgroundJob,
  TranscribeSubtitleBackgroundJob,
  TranslateSubtitleBackgroundJob,
} from "@/types/background-jobs"

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type SubtitleCoreJobKind =
  | "transcribe-subtitle"
  | "translate-subtitle"
  | "synthesize-subtitle"
  | "process-subtitle"
export type TranscribeSubtitleCoreJob = Extract<Job, { kind: "transcribe-subtitle" }>
export type TranslateSubtitleCoreJob = Extract<Job, { kind: "translate-subtitle" }>
export type SynthesizeSubtitleCoreJob = Extract<Job, { kind: "synthesize-subtitle" }>
export type ProcessSubtitleCoreJob = Extract<Job, { kind: "process-subtitle" }>

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
 * Poll Core `get-job` until a subtitle job reaches a terminal status.
 */
export async function pollSubtitleJob<K extends SubtitleCoreJobKind>(
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

export function upsertTranscribeSubtitleJobFromCore(params: {
  id: string
  folder: string
  mediaPath: string
  title?: string
  asr: string
  language?: string
  wordTimestamps?: boolean
  format?: string
  status?: StoreJobStatus
  progress?: number
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: TranscribeSubtitleBackgroundJob = {
    id: params.id,
    name: params.title?.trim() || params.mediaPath,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "transcribe-subtitle",
    data: {
      folder: params.folder,
      mediaPath: params.mediaPath,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      asr: params.asr,
      ...(params.language?.trim() ? { language: params.language.trim() } : {}),
      ...(params.wordTimestamps ? { wordTimestamps: true as const } : {}),
      ...(params.format?.trim() ? { format: params.format.trim() } : {}),
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

export function upsertTranslateSubtitleJobFromCore(params: {
  id: string
  folder: string
  subtitlePath: string
  mediaPath?: string
  title?: string
  translator: string
  targetLanguage: string
  reflect?: boolean
  layout?: string
  status?: StoreJobStatus
  progress?: number
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: TranslateSubtitleBackgroundJob = {
    id: params.id,
    name: params.title?.trim() || params.subtitlePath,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "translate-subtitle",
    data: {
      folder: params.folder,
      subtitlePath: params.subtitlePath,
      ...(params.mediaPath?.trim() ? { mediaPath: params.mediaPath.trim() } : {}),
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      translator: params.translator,
      targetLanguage: params.targetLanguage,
      ...(params.reflect ? { reflect: true as const } : {}),
      ...(params.layout?.trim() ? { layout: params.layout.trim() } : {}),
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

export function upsertSynthesizeSubtitleJobFromCore(params: {
  id: string
  folder: string
  videoPath: string
  subtitlePath: string
  title?: string
  subtitleMode?: string
  quality?: string
  style?: string
  renderMode?: string
  layout?: string
  status?: StoreJobStatus
  progress?: number
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: SynthesizeSubtitleBackgroundJob = {
    id: params.id,
    name: params.title?.trim() || params.videoPath,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "synthesize-subtitle",
    data: {
      folder: params.folder,
      videoPath: params.videoPath,
      subtitlePath: params.subtitlePath,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      ...(params.subtitleMode?.trim() ? { subtitleMode: params.subtitleMode.trim() } : {}),
      ...(params.quality?.trim() ? { quality: params.quality.trim() } : {}),
      ...(params.style?.trim() ? { style: params.style.trim() } : {}),
      ...(params.renderMode?.trim() ? { renderMode: params.renderMode.trim() } : {}),
      ...(params.layout?.trim() ? { layout: params.layout.trim() } : {}),
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

export function upsertProcessSubtitleJobFromCore(params: {
  id: string
  folder: string
  mediaPath: string
  title?: string
  asr?: string
  language?: string
  wordTimestamps?: boolean
  format?: string
  noOptimize?: boolean
  noSplit?: boolean
  noTranslate?: boolean
  translator?: string
  targetLanguage?: string
  reflect?: boolean
  layout?: string
  prompt?: string
  noSynthesize?: boolean
  subtitleMode?: string
  quality?: string
  style?: string
  renderMode?: string
  synthesizeLayout?: string
  status?: StoreJobStatus
  progress?: number
  error?: string
}): void {
  const existing = useBackgroundJobsStore.getState().jobs.find((j) => j.id === params.id)
  const next: ProcessSubtitleBackgroundJob = {
    id: params.id,
    name: params.title?.trim() || params.mediaPath,
    status: params.status ?? "pending",
    progress: params.progress ?? 0,
    type: "process-subtitle",
    data: {
      folder: params.folder,
      mediaPath: params.mediaPath,
      ...(params.title?.trim() ? { title: params.title.trim() } : {}),
      ...(params.asr?.trim() ? { asr: params.asr.trim() } : {}),
      ...(params.language?.trim() ? { language: params.language.trim() } : {}),
      ...(params.wordTimestamps !== undefined ? { wordTimestamps: params.wordTimestamps } : {}),
      ...(params.format?.trim() ? { format: params.format.trim() } : {}),
      ...(params.noOptimize !== undefined ? { noOptimize: params.noOptimize } : {}),
      ...(params.noSplit !== undefined ? { noSplit: params.noSplit } : {}),
      ...(params.noTranslate !== undefined ? { noTranslate: params.noTranslate } : {}),
      ...(params.translator?.trim() ? { translator: params.translator.trim() } : {}),
      ...(params.targetLanguage?.trim() ? { targetLanguage: params.targetLanguage.trim() } : {}),
      ...(params.reflect !== undefined ? { reflect: params.reflect } : {}),
      ...(params.layout?.trim() ? { layout: params.layout.trim() } : {}),
      ...(params.prompt?.trim() ? { prompt: params.prompt.trim() } : {}),
      ...(params.noSynthesize !== undefined ? { noSynthesize: params.noSynthesize } : {}),
      ...(params.subtitleMode?.trim() ? { subtitleMode: params.subtitleMode.trim() } : {}),
      ...(params.quality?.trim() ? { quality: params.quality.trim() } : {}),
      ...(params.style?.trim() ? { style: params.style.trim() } : {}),
      ...(params.renderMode?.trim() ? { renderMode: params.renderMode.trim() } : {}),
      ...(params.synthesizeLayout?.trim()
        ? { synthesizeLayout: params.synthesizeLayout.trim() }
        : {}),
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

export function applyTranscribeSubtitlePollUpdate(job: TranscribeSubtitleCoreJob): void {
  upsertTranscribeSubtitleJobFromCore({
    id: job.id,
    folder: job.folder,
    mediaPath: job.mediaPath,
    title: job.title,
    asr: job.asr,
    language: job.language,
    wordTimestamps: job.wordTimestamps,
    format: job.format,
    status: toJobStatus(job.status),
    progress: job.progress,
    error: job.error,
  })
}

export function applyTranslateSubtitlePollUpdate(job: TranslateSubtitleCoreJob): void {
  upsertTranslateSubtitleJobFromCore({
    id: job.id,
    folder: job.folder,
    subtitlePath: job.subtitlePath,
    mediaPath: job.mediaPath,
    title: job.title,
    translator: job.translator,
    targetLanguage: job.targetLanguage,
    reflect: job.reflect,
    layout: job.layout,
    status: toJobStatus(job.status),
    progress: job.progress,
    error: job.error,
  })
}

export function applySynthesizeSubtitlePollUpdate(job: SynthesizeSubtitleCoreJob): void {
  upsertSynthesizeSubtitleJobFromCore({
    id: job.id,
    folder: job.folder,
    videoPath: job.videoPath,
    subtitlePath: job.subtitlePath,
    title: job.title,
    subtitleMode: job.subtitleMode,
    quality: job.quality,
    style: job.style,
    renderMode: job.renderMode,
    layout: job.layout,
    status: toJobStatus(job.status),
    progress: job.progress,
    error: job.error,
  })
}

export function applyProcessSubtitlePollUpdate(job: ProcessSubtitleCoreJob): void {
  upsertProcessSubtitleJobFromCore({
    id: job.id,
    folder: job.folder,
    mediaPath: job.mediaPath,
    title: job.title,
    asr: job.asr,
    language: job.language,
    wordTimestamps: job.wordTimestamps,
    format: job.format,
    noOptimize: job.noOptimize,
    noSplit: job.noSplit,
    noTranslate: job.noTranslate,
    translator: job.translator,
    targetLanguage: job.targetLanguage,
    reflect: job.reflect,
    layout: job.layout,
    prompt: job.prompt,
    noSynthesize: job.noSynthesize,
    subtitleMode: job.subtitleMode,
    quality: job.quality,
    style: job.style,
    renderMode: job.renderMode,
    synthesizeLayout: job.synthesizeLayout,
    status: toJobStatus(job.status),
    progress: job.progress,
    error: job.error,
  })
}
