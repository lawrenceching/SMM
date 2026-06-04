import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import { useDialogs } from '@/providers/dialog-provider'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import type {
  BackgroundJob,
  DownloadVideoBackgroundJobData,
  TranscribeBackgroundJobData,
  TranslateBackgroundJobData,
  SynthesizeBackgroundJobData,
  ProcessBackgroundJobData,
  FfmpegConvertBackgroundJobData,
  FfmpegWriteTagsBackgroundJobData,
} from '@/types/background-jobs'
import {
  getAllJobs,
  putJob,
  deleteJob,
  isWithinOneHour,
  selectRecordsForBackgroundJobsUi,
  cancelPendingJobsByParentId,
  type TaskJobRecord,
} from '@/lib/downloadTaskDb'
import { JOB_TYPE_REGISTRY, ALL_JOB_TYPES } from '@/lib/jobTypeRegistry'
import {
  COMMAND_EXECUTION_STATUS_POLL_MS,
  pollCommandExecutionStatusAndReconcile,
} from '@/lib/commandExecutionStatusPoller'
import { getExecutionIdFromJobRecord } from '@/lib/reconcileJobRecordWithCommandStatus'
import { syncJobRecordsToStore } from '@/lib/jobRecordMapper'
import { executeCmdToCompletionWithHeaders } from '@/lib/whitelistedCmd/executeCmdToCompletion'
import type { YtdlpProgressData } from '@/lib/whitelistedCmd/executeCmdToCompletion'
import {
  buildFfmpegConvertArgs,
  buildFfmpegWriteTagsArgs,
  type FfmpegConvertFormat,
  type FfmpegConvertPreset,
} from '@/lib/whitelistedCmd'
import {
  buildYtdlpDownloadArgs,
  parseYtdlpDownloadStdout,
} from '@core/whitelistedCmd/ytdlp'
import {
  classifyYtdlpError,
  getYtdlpErrorMessage,
} from '@/lib/ytdlpErrorDetection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StartJobResult =
  | { started: true }
  | {
      started: false
      reason: 'sw-not-ready' | 'job-not-found' | 'invalid-job-type' | 'concurrency-blocked'
    }

export interface JobOrchestratorContextValue {
  /** Raw IDB records, filtered to within-one-hour (orchestrator / auto-start). */
  jobRecords: TaskJobRecord[]
  /** Newest IDB records for the status-bar popover (up to 100). */
  popoverJobRecords: TaskJobRecord[]
  /** Whether the orchestrator is ready (initialised + IDB synced). */
  isReady: boolean
  /** Re-read IndexedDB and sync into the background-jobs store. */
  refreshFromIndexedDB: (source?: string) => Promise<void>

  createJob(job: BackgroundJob): Promise<string>
  createJobs(jobs: BackgroundJob[]): Promise<{
    successIds: string[]
    failures: Array<{ job: BackgroundJob; error: string }>
  }>
  startJob(id: string, options?: { forceStart?: boolean }): Promise<StartJobResult>
  stopJob(id: string): void
  removeJob(id: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const JobOrchestratorContext = createContext<JobOrchestratorContextValue | null>(null)

/** Serializes IDB→store sync across parallel callers (StrictMode, popover). */
let syncFromIndexedDBChain: Promise<unknown> = Promise.resolve()

/** Poll IndexedDB while jobs are pending/running (safety net for reconciliation). */
const ACTIVE_JOB_POLL_INTERVAL_MS = 5_000

export function useJobOrchestratorContext(): JobOrchestratorContextValue {
  const ctx = useContext(JobOrchestratorContext)
  if (!ctx) throw new Error('useJobOrchestratorContext must be used inside <JobOrchestratorProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Helpers — videocaptioner arg builders
// ---------------------------------------------------------------------------

const VIDEOCAPTIONER_DUMMY_API_KEY = 'dummykey'

function ensureVcApiKey(args: string[]): void {
  if (!args.includes('--api-key')) {
    args.push('--api-key', VIDEOCAPTIONER_DUMMY_API_KEY)
  }
}

function buildTranscribeArgs(data: TranscribeBackgroundJobData): string[] {
  const vc = data.videoCaptioner ?? {}
  const args: string[] = ['transcribe', data.mediaPathPlatform || data.mediaPath]
  args.push('--asr', vc.asr || 'bijian')
  if (vc.language) args.push('--language', vc.language)
  if (vc.wordTimestamps === true) args.push('--word-timestamps')
  args.push('--format', vc.format || 'srt')
  return args
}

function buildTranslateArgs(data: TranslateBackgroundJobData): string[] {
  const args: string[] = [
    'subtitle',
    data.subtitlePathPlatform || data.subtitlePath,
    '--translator', data.translator,
    '--target-language', data.targetLanguage,
    '--no-optimize',
    '--no-split',
  ]
  if (data.reflect === true) args.push('--reflect')
  if (data.layout) args.push('--layout', data.layout)
  if (data.translator === 'llm' && data.llm?.apiKey) {
    args.push('--api-key', data.llm.apiKey)
    if (data.llm.apiBase) args.push('--api-base', data.llm.apiBase)
    if (data.llm.model) args.push('--model', data.llm.model)
  }
  ensureVcApiKey(args)
  return args
}

function buildSynthesizeArgs(data: SynthesizeBackgroundJobData): string[] {
  const args: string[] = [
    'synthesize',
    data.videoPathPlatform || data.videoPath,
    '-s', data.subtitlePathPlatform || data.subtitlePath,
  ]
  if (data.subtitleMode) args.push('--subtitle-mode', data.subtitleMode)
  if (data.quality) args.push('--quality', data.quality)
  if (data.style) args.push('--style', data.style)
  if (data.renderMode) args.push('--render-mode', data.renderMode)
  if (data.layout) args.push('--layout', data.layout)
  ensureVcApiKey(args)
  return args
}

function buildProcessArgs(data: ProcessBackgroundJobData): string[] {
  const args: string[] = ['process', data.mediaPathPlatform || data.mediaPath]
  args.push('--asr', data.asr || 'bijian')
  if (data.language) args.push('--language', data.language)
  if (data.wordTimestamps === true) args.push('--word-timestamps')
  args.push('--format', data.format || 'srt')
  if (data.noOptimize === true) args.push('--no-optimize')
  if (data.noSplit === true) args.push('--no-split')
  if (data.noTranslate === true) {
    args.push('--no-translate')
  } else if (data.translator && data.targetLanguage) {
    args.push('--translator', data.translator, '--target-language', data.targetLanguage)
    if (data.reflect === true) args.push('--reflect')
    if (data.layout) args.push('--layout', data.layout)
    if (data.prompt) args.push('--prompt', data.prompt)
    if (data.translator === 'llm' && data.llm?.apiKey) {
      args.push('--api-key', data.llm.apiKey)
      if (data.llm.apiBase) args.push('--api-base', data.llm.apiBase)
      if (data.llm.model) args.push('--model', data.llm.model)
    }
  }
  if (data.noSynthesize === true) {
    args.push('--no-synthesize')
  } else {
    if (data.subtitleMode) args.push('--subtitle-mode', data.subtitleMode)
    if (data.quality) args.push('--quality', data.quality)
    if (data.style) args.push('--style', data.style)
    if (data.renderMode) args.push('--render-mode', data.renderMode)
    if (data.synthesizeLayout) args.push('--layout', data.synthesizeLayout)
  }
  ensureVcApiKey(args)
  return args
}

/** Timeout per job type — matches original Service Worker values. */
const JOB_TIMEOUT_MS: Record<string, number> = {
  'download-video': 60 * 60 * 1000,       // 1 hour
  'transcribe': 10 * 60 * 1000,            // 10 min
  'translate': 10 * 60 * 1000,             // 10 min
  'synthesize': 60 * 60 * 1000,            // 1 hour
  'process': 2 * 60 * 60 * 1000,           // 2 hours
  'ffmpeg-convert': 60 * 60 * 1000,        // 1 hour
  'ffmpeg-write-tags': 5 * 60 * 1000,      // 5 min
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JobOrchestratorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('components')
  const tRef = useRef(t)
  tRef.current = t

  // Optional log dialog integration — gracefully handle missing DialogProvider
  const openLogDialogRef = useRef<((params: { executionId: string; jobTitle: string; isRunning?: boolean }) => void) | undefined>(undefined)
  try {
    const { logDialog } = useDialogs()
    openLogDialogRef.current = logDialog[0]
  } catch {
    openLogDialogRef.current = undefined
  }

  const [jobRecords, setJobRecords] = useState<TaskJobRecord[]>([])
  const [popoverJobRecords, setPopoverJobRecords] = useState<TaskJobRecord[]>([])
  const [isReady, setIsReady] = useState(false)

  // Mutable refs so callbacks always see the latest values without stale closures.
  const jobRecordsRef = useRef<TaskJobRecord[]>([])
  const isReadyRef = useRef(false)

  /** Global concurrency: at most 1 running job per type. */
  const runningJobsRef = useRef<Map<string, string>>(new Map())        // type → jobId
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map()) // jobId → controller

  // Refs to break circular dependency between executeJob ↔ tryAutoStart
  const executeJobRef = useRef<(jobId: string) => Promise<void>>(async () => {})

  // ---------------------------------------------------------------------------
  // Core sync
  // ---------------------------------------------------------------------------

  /** Read all IDB jobs, update local state + Zustand store. Returns fresh records. */
  const syncFromIndexedDB = useCallback(async (_source = 'unknown'): Promise<TaskJobRecord[]> => {
    const run = async (): Promise<TaskJobRecord[]> => {
      let records: TaskJobRecord[] = []
      try {
        records = await getAllJobs()
      } catch {
        return jobRecordsRef.current
      }
      const orchestratorRecords = records.filter((r) => isWithinOneHour(r.createdAt))
      const uiRecords = selectRecordsForBackgroundJobsUi(records)
      jobRecordsRef.current = orchestratorRecords
      setJobRecords(orchestratorRecords)
      setPopoverJobRecords(uiRecords)
      syncJobRecordsToStore(uiRecords)
      return orchestratorRecords
    }

    const queued = syncFromIndexedDBChain.then(run, run)
    syncFromIndexedDBChain = queued.then(
      () => {},
      () => {},
    )
    return queued
  }, [])

  const refreshFromIndexedDB = useCallback(
    async (source = 'refresh') => {
      await syncFromIndexedDB(source)
    },
    [syncFromIndexedDB],
  )

  // Load persisted jobs on mount.
  useEffect(() => {
    void syncFromIndexedDB('mount:eager')
  }, [syncFromIndexedDB])

  // ---------------------------------------------------------------------------
  // Abort running-on-mount (no SW → all running jobs are stale on fresh load)
  // ---------------------------------------------------------------------------

  const abortRunningJobsOnMount = useCallback(async (): Promise<void> => {
    const records = await getAllJobs()
    for (const record of records) {
      if (record.type === 'test-delay') continue
      if (record.status === 'running') {
        record.status = 'aborted'
        record.updatedAt = Date.now()
        if (record.type === 'download-video' && record.data) {
          try {
            const data = JSON.parse(record.data) as {
              videos?: Array<{ status?: string }>
            }
            if (Array.isArray(data.videos)) {
              for (const v of data.videos) {
                if (v.status === 'downloading') {
                  v.status = 'pending'
                }
              }
              record.data = JSON.stringify(data)
            }
          } catch {
            // ignore parse errors
          }
        }
        await putJob(record)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // executeJob — runs a single job to completion (no SW proxy)
  // ---------------------------------------------------------------------------

  const executeJob = useCallback(async (jobId: string): Promise<void> => {
    const record = jobRecordsRef.current.find((r) => r.id === jobId)
    if (!record || record.status !== 'pending') return

    const jobType = record.type
    const config = JOB_TYPE_REGISTRY[jobType]
    if (!config) return

    // Concurrency check: at most 1 running per type globally
    if (runningJobsRef.current.has(jobType)) return

    // Check auto-start preference
    try {
      if (localStorage.getItem(config.autoStartKey) === 'false') return
    } catch {
      // localStorage unavailable — treat as enabled
    }

    // Parse job data
    let data: Record<string, unknown>
    try {
      data = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      data = {}
    }

    const controller = new AbortController()
    abortControllersRef.current.set(jobId, controller)
    runningJobsRef.current.set(jobType, jobId)

    try {
      // Mark as running
      record.status = 'running'
      record.updatedAt = Date.now()
      await putJob(record)

      await syncFromIndexedDB('executeJob:started')
      if (config.toasts?.started) {
        toast.info(config.toasts.started(tRef.current))
      }

      let success = false
      let wasStopped = false

      switch (jobType) {
        // ── Download ──────────────────────────────────────────────
        case 'download-video': {
          const downloadData = data as unknown as DownloadVideoBackgroundJobData
          const videos = downloadData.videos ?? []
          const totalVideos = videos.length
          let allSucceeded = true
          let completedVideos = 0

          for (let i = 0; i < videos.length; i++) {
            if (controller.signal.aborted) { wasStopped = true; break }

            const video = videos[i]
            if (video.status === 'succeeded') {
              completedVideos++
              continue
            }

            // Progress is now consumed by BackgroundJobsPopoverList via
            // useYtdlpDownloadProgressQuery (polls the CLI command log).
            // The onProgress callback is still wired to executeCmd's NDJSON
            // stream (it fires), but does nothing meaningful here.
            const handleYtdlpProgress = (_p: YtdlpProgressData): void => {
              // no-op — progress is read from the command log.
            }

            video.status = 'downloading'
            record.data = JSON.stringify(data)
            record.updatedAt = Date.now()

            try {
              const executionId = crypto.randomUUID()
              data.executionId = executionId
              record.data = JSON.stringify(data)
              await putJob(record)

              const args = buildYtdlpDownloadArgs({
                url: video.url,
                folder: downloadData.folder,
                format: downloadData.ytdlpFormat,
                cookiesFile: downloadData.ytdlpCookiesFile,
                cookiesFromBrowser: downloadData.ytdlpCookiesFromBrowser,
                args: downloadData.ytdlpExtraArgs,
                jsRuntime: downloadData.ytdlpJsRuntime,
                jsRuntimePath: downloadData.ytdlpJsRuntimePath,
                proxy: downloadData.ytdlpProxy,
              })

              const result = await executeCmdToCompletionWithHeaders(
                { command: 'yt-dlp', args, tty: true },
                {
                  timeoutMs: JOB_TIMEOUT_MS['download-video'],
                  signal: controller.signal,
                  executionId,
                  onProgress: handleYtdlpProgress,
                },
              )

              if (result.executionId) data.executionId = result.executionId
              if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined

              if (!result.success) {
                video.status = 'failed'
                allSucceeded = false
                // Classify yt-dlp error for a specific toast message
                if (!data.ytdlpErrorType) {
                  const errResult = classifyYtdlpError({
                    stderr: result.stderr ?? '',
                    stdout: result.stdout ?? '',
                    exitCode: result.exitCode,
                  })
                  data.ytdlpErrorType = errResult.type
                  data.ytdlpErrorMessage = getYtdlpErrorMessage(errResult, tRef.current as any)
                }
              } else {
                const outPath = parseYtdlpDownloadStdout(result.stdout)
                if (outPath) {
                  // Store download path (optional, currently not used by SW either)
                }
                video.status = 'succeeded'
                completedVideos++
              }
            } catch (e) {
              if (controller.signal.aborted) {
                video.status = 'pending'
                wasStopped = true
                break
              }
              video.status = 'failed'
              allSucceeded = false
              // Classify yt-dlp error from exception message
              if (!data.ytdlpErrorType) {
                const errMessage = e instanceof Error ? e.message : String(e)
                const errResult = classifyYtdlpError({
                  stderr: errMessage,
                  stdout: '',
                  exitCode: null,
                })
                data.ytdlpErrorType = errResult.type
                data.ytdlpErrorMessage = getYtdlpErrorMessage(errResult, tRef.current as any)
              }
            }

            // Update persisted progress to reflect completed videos.
            record.progress = totalVideos > 0
              ? Math.min(100, (completedVideos / totalVideos) * 100)
              : 0
            record.data = JSON.stringify(data)
            record.updatedAt = Date.now()
            await putJob(record)
            await syncFromIndexedDB('executeJob:video-completed')
          }

          if (wasStopped) {
            record.status = 'stopped'
          } else if (allSucceeded) {
            record.status = 'succeeded'
            record.progress = 100
            success = true
          } else {
            record.status = 'failed'
          }
          break
        }

        // ── Transcribe ────────────────────────────────────────────
        case 'transcribe': {
          const td = data as unknown as TranscribeBackgroundJobData
          const executionId = crypto.randomUUID()

          const args = buildTranscribeArgs(td)
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'videocaptioner', args },
            { timeoutMs: JOB_TIMEOUT_MS['transcribe'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress
          break
        }

        // ── Translate ─────────────────────────────────────────────
        case 'translate': {
          const td = data as unknown as TranslateBackgroundJobData
          const executionId = crypto.randomUUID()

          const args = buildTranslateArgs(td)
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'videocaptioner', args },
            { timeoutMs: JOB_TIMEOUT_MS['translate'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress
          break
        }

        // ── Synthesize ────────────────────────────────────────────
        case 'synthesize': {
          const sd = data as unknown as SynthesizeBackgroundJobData
          const executionId = crypto.randomUUID()

          const args = buildSynthesizeArgs(sd)
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'videocaptioner', args },
            { timeoutMs: JOB_TIMEOUT_MS['synthesize'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress
          break
        }

        // ── Process ───────────────────────────────────────────────
        case 'process': {
          const pd = data as unknown as ProcessBackgroundJobData
          const executionId = crypto.randomUUID()

          const args = buildProcessArgs(pd)
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'videocaptioner', args },
            { timeoutMs: JOB_TIMEOUT_MS['process'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress
          break
        }

        // ── FFmpeg Convert ────────────────────────────────────────
        case 'ffmpeg-convert': {
          const cd = data as unknown as FfmpegConvertBackgroundJobData
          const executionId = crypto.randomUUID()

          const args = buildFfmpegConvertArgs(
            cd.inputPathPlatform,
            cd.outputPathPlatform,
            cd.outputFormat as FfmpegConvertFormat,
            cd.preset as FfmpegConvertPreset,
          )
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'ffmpeg', args },
            { timeoutMs: JOB_TIMEOUT_MS['ffmpeg-convert'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress
          break
        }

        // ── FFmpeg Write Tags ─────────────────────────────────────
        case 'ffmpeg-write-tags': {
          const wd = data as unknown as FfmpegWriteTagsBackgroundJobData
          const executionId = crypto.randomUUID()

          // Build temp file path (same logic as writeMediaTags in api/ffmpeg.ts)
          const extIdx = wd.filePathPlatform.lastIndexOf('.');
          const ext = extIdx >= 0 ? wd.filePathPlatform.slice(extIdx) : '';
          const base = ext ? wd.filePathPlatform.slice(0, extIdx) : wd.filePathPlatform;
          const tempFilePath = `${base}.smm-temp${ext}`;

          const args = buildFfmpegWriteTagsArgs(
            wd.filePathPlatform,
            tempFilePath,
            wd.tags,
          )
          const result = await executeCmdToCompletionWithHeaders(
            { command: 'ffmpeg', args },
            { timeoutMs: JOB_TIMEOUT_MS['ffmpeg-write-tags'], signal: controller.signal, executionId },
          )

          if (result.executionId) data.executionId = result.executionId
          if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
          success = result.success

          if (controller.signal.aborted) wasStopped = true
          record.status = wasStopped ? 'stopped' : (success ? 'succeeded' : 'failed')
          record.progress = success ? 100 : record.progress

          // On success, move original to trash and rename temp file
          if (success) {
            try {
              const { moveFileToTrash } = await import('@/api/moveFileToTrash')
              await moveFileToTrash(wd.filePathPlatform)
            } catch {
              // If trash fails, job still succeeded — the temp file remains
              console.warn('[JobOrchestrator] failed to trash original after tag write')
            }
            try {
              const resp = await fetch('/api/renameFiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  files: [{ from: tempFilePath, to: wd.filePathPlatform }],
                }),
              })
              if (!resp.ok) {
                console.warn('[JobOrchestrator] rename after tag write failed')
              }
            } catch {
              console.warn('[JobOrchestrator] rename after tag write error')
            }
          }
          break
        }

        default:
          return
      }

      // Persist final state
      record.data = JSON.stringify(data)
      record.updatedAt = Date.now()
      await putJob(record)

      // Toast notification
      if (wasStopped) {
        // No toast for stopped (user initiated)
      } else if (success && config.toasts?.succeeded) {
        toast.success(config.toasts.succeeded(tRef.current))
      } else if (!success) {
        // Determine the toast message
        const ytdlpErrorType = data.ytdlpErrorType as string | undefined
        const ytdlpErrorMessage = data.ytdlpErrorMessage as string | undefined
        let message: string
        if (ytdlpErrorType && ytdlpErrorMessage && ytdlpErrorType !== 'unknown') {
          message = ytdlpErrorMessage
        } else if (config.toasts?.failed) {
          message = config.toasts.failed(tRef.current)
        } else {
          message = tRef.current('statusBar.backgroundJobs.toasts.genericFailed', { name: record.name } as Record<string, unknown>)
        }

        // Add "日志" action button when executionId and log dialog are available
        const execId = data.executionId as string | undefined
        if (execId && openLogDialogRef.current) {
          toast.error(message, {
            action: {
              label: tRef.current('statusBar.backgroundJobs.logButton'),
              onClick: () => openLogDialogRef.current!({
                executionId: execId,
                jobTitle: record.name,
                isRunning: false,
              }),
            },
          })
        } else {
          toast.error(message)
        }
      }

      // Handle cancel-siblings on failure
      if (!success && !wasStopped && record.parentId) {
        await cancelPendingJobsByParentId(record.parentId)
      }
    } catch (e) {
      // Unexpected error — mark as failed
      record.status = 'failed'
      record.updatedAt = Date.now()
      record.data = JSON.stringify(data)
      await putJob(record)
      console.error('[JobOrchestrator] executeJob unexpected error', e)
    } finally {
      abortControllersRef.current.delete(jobId)
      runningJobsRef.current.delete(jobType)

      await syncFromIndexedDB('executeJob:finished')

      // Auto-chain: start next pending job of same type
      const freshRecords = jobRecordsRef.current
      try {
        const nextPending = freshRecords.find(
          (r) => r.type === jobType && r.status === 'pending',
        )
        if (nextPending) {
          void executeJobRef.current(nextPending.id)
        }
      } catch {
        // best-effort chaining
      }
    }
  }, [syncFromIndexedDB])

  executeJobRef.current = executeJob

  // ---------------------------------------------------------------------------
  // Stop a running job
  // ---------------------------------------------------------------------------

  const stopExecutingJob = useCallback(async (jobId: string): Promise<void> => {
    const controller = abortControllersRef.current.get(jobId)
    if (controller) {
      controller.abort()
    }

    // If the job is still in IDB as running, update it
    const record = jobRecordsRef.current.find((r) => r.id === jobId)
    if (record && record.status === 'running') {
      record.status = 'stopped'
      record.updatedAt = Date.now()
      if (record.data) {
        try {
          const data = JSON.parse(record.data) as {
            videos?: Array<{ status?: string }>
          }
          if (Array.isArray(data.videos)) {
            for (const v of data.videos) {
              if (v.status === 'downloading') {
                v.status = 'pending'
              }
            }
            record.data = JSON.stringify(data)
          }
        } catch {
          // ignore parse errors
        }
      }
      await putJob(record)
      await syncFromIndexedDB('stopJob')
    }
  }, [syncFromIndexedDB])

  // ---------------------------------------------------------------------------
  // Auto-start
  // ---------------------------------------------------------------------------

  /**
   * Attempt to auto-start the next pending job for `(type, folder)`.
   * No-op when: not ready, auto-start disabled, or a job of the same type
   * is already running.
   */
  const tryAutoStart = useCallback(
    (type: string, folder: string, records?: TaskJobRecord[]): void => {
      if (!isReadyRef.current) return
      const config = JOB_TYPE_REGISTRY[type]
      if (!config) return

      try {
        if (localStorage.getItem(config.autoStartKey) === 'false') return
      } catch {
        // localStorage unavailable — treat as enabled
      }

      const current = records ?? jobRecordsRef.current
      const hasRunning = current.some(
        (r) => r.type === type && r.status === 'running',
      )
      if (hasRunning) return

      const next = current.find(
        (r) => r.type === type && r.folder === folder && r.status === 'pending',
      )
      if (!next) return

      void executeJobRef.current(next.id)
    },
    [], // empty deps — uses refs for all dynamic values
  )

  /** Try auto-start for every distinct (type, folder) combo in the current records. */
  const tryAutoStartAll = useCallback(
    (records?: TaskJobRecord[]): void => {
      const current = records ?? jobRecordsRef.current
      const seen = new Set<string>()
      for (const r of current) {
        if (!ALL_JOB_TYPES.includes(r.type)) continue
        const key = `${r.type}\x00${r.folder}`
        if (seen.has(key)) continue
        seen.add(key)
        tryAutoStart(r.type, r.folder, current)
      }
    },
    [tryAutoStart],
  )

  // ---------------------------------------------------------------------------
  // indexed-updated listener
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = async () => {
      const fresh = await syncFromIndexedDB('indexed-updated')
      tryAutoStartAll(fresh)
    }
    window.addEventListener('indexed-updated', handler)
    return () => window.removeEventListener('indexed-updated', handler)
  }, [syncFromIndexedDB, tryAutoStartAll])

  const hasActiveJobs = useMemo(
    () => jobRecords.some((r) => r.status === 'running' || r.status === 'pending'),
    [jobRecords],
  )

  const hasRunningJobsWithExecutionId = useMemo(
    () =>
      jobRecords.some(
        (r) => r.status === 'running' && getExecutionIdFromJobRecord(r) != null,
      ),
    [jobRecords],
  )

  useEffect(() => {
    if (!hasActiveJobs) return
    const id = setInterval(() => {
      void syncFromIndexedDB('poll')
    }, ACTIVE_JOB_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [hasActiveJobs, syncFromIndexedDB])

  useEffect(() => {
    if (!hasRunningJobsWithExecutionId) return
    void pollCommandExecutionStatusAndReconcile()
    const id = setInterval(() => {
      void pollCommandExecutionStatusAndReconcile()
    }, COMMAND_EXECUTION_STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [hasRunningJobsWithExecutionId])

  // ---------------------------------------------------------------------------
  // Mount: abort stale running jobs, sync IDB, auto-start
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function init() {
      await abortRunningJobsOnMount()
      if (cancelled) return
      const fresh = await syncFromIndexedDB('mount:init')
      if (cancelled) return
      isReadyRef.current = true
      setIsReady(true)
      tryAutoStartAll(fresh)
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [abortRunningJobsOnMount, syncFromIndexedDB, tryAutoStartAll])

  // ---------------------------------------------------------------------------
  // Imperative API
  // ---------------------------------------------------------------------------

  const createJob = useCallback(
    async (job: BackgroundJob): Promise<string> => {
      const now = Date.now()
      const folder = (job.data as { folder?: string }).folder ?? ''
      const record: TaskJobRecord = {
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress,
        type: job.type,
        folder,
        data: JSON.stringify(job.data),
        parentId: job.parentId,
        createdAt: now,
        updatedAt: now,
      }
      await putJob(record)
      const fresh = await syncFromIndexedDB('createJob')
      tryAutoStart(job.type, folder, fresh)
      return job.id
    },
    [syncFromIndexedDB, tryAutoStart],
  )

  const createJobs = useCallback(
    async (
      jobs: BackgroundJob[],
    ): Promise<{ successIds: string[]; failures: Array<{ job: BackgroundJob; error: string }> }> => {
      const successIds: string[] = []
      const failures: Array<{ job: BackgroundJob; error: string }> = []

      for (const job of jobs) {
        try {
          const now = Date.now()
          const folder = (job.data as { folder?: string }).folder ?? ''
          const record: TaskJobRecord = {
            id: job.id,
            name: job.name,
            status: job.status,
            progress: job.progress,
            type: job.type,
            folder,
            data: JSON.stringify(job.data),
            parentId: job.parentId,
            createdAt: now,
            updatedAt: now,
          }
          await putJob(record)
          successIds.push(job.id)
        } catch (e) {
          failures.push({ job, error: e instanceof Error ? e.message : String(e) })
        }
      }

      const fresh = await syncFromIndexedDB('createJobs')

      // Trigger auto-start for each unique (type, folder) of successfully created jobs.
      const seen = new Set<string>()
      for (const job of jobs) {
        if (!successIds.includes(job.id)) continue
        const folder = (job.data as { folder?: string }).folder ?? ''
        const key = `${job.type}\x00${folder}`
        if (seen.has(key)) continue
        seen.add(key)
        tryAutoStart(job.type, folder, fresh)
      }

      return { successIds, failures }
    },
    [syncFromIndexedDB, tryAutoStart],
  )

  const startJob = useCallback(
    async (id: string, options?: { forceStart?: boolean }): Promise<StartJobResult> => {
      if (!isReadyRef.current) return { started: false, reason: 'sw-not-ready' }

      const record = jobRecordsRef.current.find((r) => r.id === id)
      if (!record) return { started: false, reason: 'job-not-found' }

      const config = JOB_TYPE_REGISTRY[record.type]
      if (!config) return { started: false, reason: 'invalid-job-type' }

      if (!options?.forceStart) {
        const hasRunning = jobRecordsRef.current.some(
          (r) => r.type === record.type && r.status === 'running',
        )
        if (hasRunning) return { started: false, reason: 'concurrency-blocked' }
      }

      void executeJobRef.current(id)
      return { started: true }
    },
    [], // uses refs, no need for executeJob in deps
  )

  const stopJob = useCallback(
    (id: string): void => {
      stopExecutingJob(id)
    },
    [stopExecutingJob],
  )

  const removeJob = useCallback(
    async (id: string): Promise<void> => {
      // Abort if running
      const controller = abortControllersRef.current.get(id)
      if (controller) {
        controller.abort()
      }
      await deleteJob(id)
      await syncFromIndexedDB('removeJob')
    },
    [syncFromIndexedDB],
  )

  // ---------------------------------------------------------------------------
  // window.__jobOrchestrator bridge (for non-React consumers)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    window.__jobOrchestrator = {
      createJob,
      createJobs,
      startJob,
      stopJob,
      removeJob,
      isReady: () => isReadyRef.current,
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__jobOrchestrator
    }
  }, [createJob, createJobs, startJob, stopJob, removeJob])

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const contextValue = useMemo<JobOrchestratorContextValue>(
    () => ({
      jobRecords,
      popoverJobRecords,
      isReady,
      refreshFromIndexedDB,
      createJob,
      createJobs,
      startJob,
      stopJob,
      removeJob,
    }),
    [
      jobRecords,
      popoverJobRecords,
      isReady,
      refreshFromIndexedDB,
      createJob,
      createJobs,
      startJob,
      stopJob,
      removeJob,
    ],
  )

  return (
    <JobOrchestratorContext.Provider value={contextValue}>
      {children}
    </JobOrchestratorContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Reactive hooks (exported separately — these are real React hooks)
// ---------------------------------------------------------------------------

/**
 * Returns per-file status sets for the given folder + job type.
 * Driven entirely by the registry's `extractPath` — no per-type branches.
 */
export function useFileStatuses(folder: string, type: string) {
  const { jobRecords } = useJobOrchestratorContext()
  const config = JOB_TYPE_REGISTRY[type]

  return useMemo(() => {
    const runningPaths = new Set<string>()
    const pendingPaths = new Set<string>()
    const failedPaths = new Set<string>()
    const jobIdsByPath = new Map<string, string[]>()
    const primaryJobIdByPath = new Map<string, string>()

    if (!config) {
      return { runningPaths, pendingPaths, failedPaths, jobIdsByPath, primaryJobIdByPath }
    }

    for (const r of jobRecords) {
      if (r.type !== type || r.folder !== folder) continue
      let data: unknown
      try {
        data = JSON.parse(r.data || '{}')
      } catch {
        continue
      }
      const path = config.extractPath(data)
      if (!path) continue

      const ids = jobIdsByPath.get(path) ?? []
      ids.push(r.id)
      jobIdsByPath.set(path, ids)

      if (r.status === 'running') runningPaths.add(path)
      else if (r.status === 'pending') pendingPaths.add(path)
      else if (r.status === 'failed') failedPaths.add(path)
    }

    // Determine primary job per path: running > pending > failed > other
    for (const [path, ids] of jobIdsByPath) {
      const pick = (status: string) =>
        ids.find((id) => jobRecords.find((j) => j.id === id)?.status === status)
      const primary =
        pick('running') ?? pick('pending') ?? pick('failed') ?? ids[0]
      if (primary) primaryJobIdByPath.set(path, primary)
    }

    return { runningPaths, pendingPaths, failedPaths, jobIdsByPath, primaryJobIdByPath }
  }, [jobRecords, folder, type, config])
}

/** All jobs in the store (convenience alias over `jobRecords`). */
export function useJobs() {
  return useJobOrchestratorContext().jobRecords
}
