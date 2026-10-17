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
import { apiFetch } from '@/lib/apiFetch'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import { DialogContext } from '@/providers/dialog-provider'
import type {
  BackgroundJob,
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
import {
  buildFfmpegConvertArgs,
  buildFfmpegCompressArgs,
  buildFfmpegWriteTagsArgs,
  type FfmpegCompressProbe,
  type FfmpegCompressRun,
  type FfmpegConvertFormat,
  type FfmpegConvertPreset,
} from '@/lib/whitelistedCmd'

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
  /**
   * Mark a `pending` persisted job as `aborted` in IndexedDB.
   * No-op for non-pending or missing records. Used by `stopAllJobs` to
   * drain the pending queue before stopping running jobs — see
   * `docs/design/background-jobs-stop-all.md` for the ordering rationale.
   */
  markPendingAsAborted(id: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const JobOrchestratorContext = createContext<JobOrchestratorContextValue | null>(null)

/** Serializes IDB→store sync across parallel callers (StrictMode, popover). */
let syncFromIndexedDBChain: Promise<unknown> = Promise.resolve()

/** Poll IndexedDB while jobs are pending/running (safety net for reconciliation). */
const ACTIVE_JOB_POLL_INTERVAL_MS = 5_000

// eslint-disable-next-line react-refresh/only-export-components
export function useJobOrchestratorContext(): JobOrchestratorContextValue {
  const ctx = useContext(JobOrchestratorContext)
  if (!ctx) throw new Error('useJobOrchestratorContext must be used inside <JobOrchestratorProvider>')
  return ctx
}

/** Timeout per job type — matches original Service Worker values. */
const JOB_TIMEOUT_MS: Record<string, number> = {
  'download-video': 60 * 60 * 1000,       // 1 hour
  'ffmpeg-convert': 60 * 60 * 1000,        // 1 hour
  'ffmpeg-compress': 2 * 60 * 60 * 1000,   // 2 hours (compression may take longer)
  'ffmpeg-write-tags': 5 * 60 * 1000,      // 5 min
}

/** Run ffprobe on a video file to gather duration, width, height. */
async function probeVideoForCompression(filePath: string): Promise<FfmpegCompressProbe> {
  const emptyProbe: FfmpegCompressProbe = { durationSec: 0, width: 0, height: 0 }
  try {
    const result = await executeCmdToCompletionWithHeaders(
      {
        command: 'ffprobe',
        args: [
          '-v', 'error',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath,
        ],
      },
      { timeoutMs: 30_000 },
    )
    if (!result.success) return emptyProbe
    const parsed = JSON.parse(result.stdout) as {
      format?: { duration?: string }
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>
    }
    const durationSec = parsed.format?.duration
      ? Number.parseFloat(parsed.format.duration)
      : 0
    const videoStream = (parsed.streams ?? []).find((s) => s.codec_type === 'video')
    return {
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      width: videoStream?.width ?? 0,
      height: videoStream?.height ?? 0,
    }
  } catch {
    return emptyProbe
  }
}

/** Best-effort cleanup of a 2-pass ffmpeg log file. */
async function cleanupPassLog(logPath: string): Promise<void> {
  if (!logPath) return
  try {
    const { moveFileToTrash } = await import('@/api/moveFileToTrash')
    await moveFileToTrash(logPath)
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JobOrchestratorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('components')
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  // Optional log dialog integration — gracefully handle missing DialogProvider
  const openLogDialogRef = useRef<((params: { executionId: string; jobTitle: string; isRunning?: boolean }) => void) | undefined>(undefined)
  const dialogContext = useContext(DialogContext)
  useEffect(() => { openLogDialogRef.current = dialogContext?.logDialog[0] }, [dialogContext])

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
        // ── Download (legacy IndexedDB) ───────────────────────────
        // New downloads go through Core `YtdlpJob` via POST /api/download-video.
        // Leftover IndexedDB download-video rows are marked failed.
        case 'download-video': {
          data.ytdlpErrorType = 'options-error'
          data.ytdlpErrorMessage =
            'Download video jobs now run via Core YtdlpJob; restart from the Download Video dialog.'
          record.data = JSON.stringify(data)
          record.status = 'failed'
          break
        }

        // ── Transcribe / Translate / Synthesize / Process (legacy IndexedDB) ─
        // New jobs go through Core subtitle jobs. Leftover IndexedDB rows are
        // marked failed (read-only history via mapper).
        case 'transcribe':
        case 'translate': {
          data.error =
            'Transcribe/translate jobs now run via Core; restart from the dialog.'
          record.data = JSON.stringify(data)
          record.status = 'failed'
          break
        }

        case 'synthesize':
        case 'process': {
          data.error =
            'Synthesize/process jobs now run via Core; restart from the dialog.'
          record.data = JSON.stringify(data)
          record.status = 'failed'
          break
        }

        // ── FFmpeg Convert ────────────────────────────────────────
        case 'ffmpeg-convert': {
          const cd = data as unknown as FfmpegConvertBackgroundJobData
          const executionId = crypto.randomUUID()
          const isCompress = cd.compressOptions != null

          if (!isCompress) {
            const args = buildFfmpegConvertArgs(
              cd.inputPathPlatform,
              cd.outputPathPlatform,
              cd.outputFormat as FfmpegConvertFormat,
              cd.preset as FfmpegConvertPreset,
              cd.imageOptions,
            )
            const result = await executeCmdToCompletionWithHeaders(
              { command: 'ffmpeg', args },
              { timeoutMs: JOB_TIMEOUT_MS['ffmpeg-convert'], signal: controller.signal, executionId },
            )

            if (result.executionId) data.executionId = result.executionId
            if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
            success = result.success
          } else {
            // Compression: probe source then build args (potentially 2-pass)
            const probe = await probeVideoForCompression(cd.inputPathPlatform)
            const run: FfmpegCompressRun = buildFfmpegCompressArgs(
              cd.inputPathPlatform,
              cd.outputPathPlatform,
              cd.compressOptions!,
              probe,
            )

            if (run.kind === 'single') {
              const result = await executeCmdToCompletionWithHeaders(
                { command: 'ffmpeg', args: run.args },
                {
                  timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
                  signal: controller.signal,
                  executionId,
                },
              )
              if (result.executionId) data.executionId = result.executionId
              if (result.logRelativePath) data.logRelativePath = result.logRelativePath ?? undefined
              success = result.success
            } else {
              // Two-pass: pass 1 then pass 2. Both passes share the case-level
              // executionId so they append to a single `main.log` — see
              // docs/design/ffmpeg-progress-display.md. The popover then sees
              // a continuous stream of progress lines across the whole
              // compression.
              const pass1Result = await executeCmdToCompletionWithHeaders(
                { command: 'ffmpeg', args: run.pass1Args },
                {
                  timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
                  signal: controller.signal,
                  executionId,
                },
              )
              if (pass1Result.executionId) data.executionId = pass1Result.executionId
              if (pass1Result.logRelativePath) data.logRelativePath = pass1Result.logRelativePath ?? undefined

              if (controller.signal.aborted || !pass1Result.success) {
                await cleanupPassLog(run.passLogPath)
                if (controller.signal.aborted) {
                  wasStopped = true
                } else {
                  record.status = 'failed'
                }
                break
              }

              // Update progress to 50% after pass 1
              record.progress = 50
              record.updatedAt = Date.now()
              record.data = JSON.stringify(data)
              await putJob(record)
              await syncFromIndexedDB('compress:pass1-done')

              const pass2Result = await executeCmdToCompletionWithHeaders(
                { command: 'ffmpeg', args: run.pass2Args },
                {
                  timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
                  signal: controller.signal,
                  executionId,
                },
              )
              if (pass2Result.executionId) data.executionId = pass2Result.executionId
              if (pass2Result.logRelativePath) data.logRelativePath = pass2Result.logRelativePath ?? undefined
              success = pass2Result.success
              await cleanupPassLog(run.passLogPath)
            }
          }

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
              const resp = await apiFetch('/api/renameFiles', {
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
        // Determine the toast message. `ytdlpErrorMessage` — when set by
        // `resolveYtdlpError` — is always the most informative option (even
        // for "unknown" errors, since the raw cause is appended).  Fall back
        // to the job-type's generic toast only when no classified message
        // exists (e.g. for non-ytdlp job types).
        const ytdlpErrorMessage = data.ytdlpErrorMessage as string | undefined
        let message: string
        if (ytdlpErrorMessage) {
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

  useEffect(() => { executeJobRef.current = executeJob }, [executeJob])

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

  const markPendingAsAborted = useCallback(
    async (id: string): Promise<void> => {
      const record = jobRecordsRef.current.find((r) => r.id === id)
      if (!record) return
      if (record.status !== 'pending') return
      record.status = 'aborted'
      record.updatedAt = Date.now()
      await putJob(record)
      await syncFromIndexedDB('markPendingAsAborted')
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
      markPendingAsAborted,
      isReady: () => isReadyRef.current,
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__jobOrchestrator
    }
  }, [createJob, createJobs, startJob, stopJob, removeJob, markPendingAsAborted])

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
      markPendingAsAborted,
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
      markPendingAsAborted,
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
// eslint-disable-next-line react-refresh/only-export-components
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
// eslint-disable-next-line react-refresh/only-export-components
export function useJobs() {
  return useJobOrchestratorContext().jobRecords
}
