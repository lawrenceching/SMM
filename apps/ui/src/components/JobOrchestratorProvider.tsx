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
import type { BackgroundJob } from '@/types/background-jobs'
import {
  getAllJobs,
  putJob,
  deleteJob,
  isWithinOneHour,
  selectRecordsForBackgroundJobsUi,
  cancelPendingJobsByParentId,
  type TaskJobRecord,
} from '@/lib/downloadTaskDb'
import { JOB_TYPE_REGISTRY, ALL_JOB_TYPES, swEventNames } from '@/lib/jobTypeRegistry'
import { syncJobRecordsToStore } from '@/lib/jobRecordMapper'
import {
  attachDownloadServiceWorkerUpdateChecks,
  DOWNLOAD_SERVICE_WORKER_URL,
} from '@/lib/downloadServiceWorker'
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
  /** Whether the Service Worker has registered and is ready. */
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

/** Serializes IDB→store sync across parallel callers (StrictMode, SW update, popover). */
let syncFromIndexedDBChain: Promise<unknown> = Promise.resolve()

/** Poll IndexedDB while jobs are pending/running (safety net if SW postMessage is missed). */
const ACTIVE_JOB_POLL_INTERVAL_MS = 5_000

export function useJobOrchestratorContext(): JobOrchestratorContextValue {
  const ctx = useContext(JobOrchestratorContext)
  if (!ctx) throw new Error('useJobOrchestratorContext must be used inside <JobOrchestratorProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JobOrchestratorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('components')
  const tRef = useRef(t)
  tRef.current = t

  const [jobRecords, setJobRecords] = useState<TaskJobRecord[]>([])
  const [popoverJobRecords, setPopoverJobRecords] = useState<TaskJobRecord[]>([])
  const [swReady, setSwReady] = useState(false)

  // Mutable refs so callbacks always see the latest values without stale closures.
  const jobRecordsRef = useRef<TaskJobRecord[]>([])
  const swReadyRef = useRef(false)
  /** Stored after registration so postSw can use registration.active (more reliable than controller). */
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

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

  // Load persisted jobs on mount without waiting for Service Worker registration.
  useEffect(() => {
    void syncFromIndexedDB('mount:eager')
  }, [syncFromIndexedDB])

  // ---------------------------------------------------------------------------
  // SW plumbing
  // ---------------------------------------------------------------------------

  const postSw = useCallback((event: string, id: string) => {
    const target =
      swRegistrationRef.current?.active ?? navigator.serviceWorker?.controller
    if (target) {
      target.postMessage({ event, id })
    } else {
      console.warn('[JobOrchestrator] no SW controller', { event, id })
    }
  }, [])

  /** Mark all running IDB jobs as aborted (called once on SW registration). */
  const handleSwReactivate = useCallback(async (): Promise<void> => {
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
  // Auto-start
  // ---------------------------------------------------------------------------

  /**
   * Attempt to auto-start the next pending job for `(type, folder)`.
   * No-op when: SW not ready, auto-start disabled in localStorage, or a job
   * of the same (type, folder) is already running.
   */
  const tryAutoStart = useCallback(
    (type: string, folder: string, records?: TaskJobRecord[]): void => {
      if (!swReadyRef.current) return
      const config = JOB_TYPE_REGISTRY[type]
      if (!config) return

      try {
        if (localStorage.getItem(config.autoStartKey) === 'false') return
      } catch {
        // localStorage unavailable — treat as enabled
      }

      const current = records ?? jobRecordsRef.current
      const hasRunning = current.some(
        (r) => r.type === type && r.folder === folder && r.status === 'running',
      )
      if (hasRunning) return

      const next = current.find(
        (r) => r.type === type && r.folder === folder && r.status === 'pending',
      )
      if (!next) return

      postSw(swEventNames(config.messagePrefix).start, next.id)
    },
    [postSw],
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
  // SW message listener
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object' || !('event' in data)) return
      const msg = data as { event: string; id?: string }
      if (!msg.id) return
      if (msg.event.endsWith(':heartbeat')) return

      const matchedType = ALL_JOB_TYPES.find((t) => {
        const evts = swEventNames(JOB_TYPE_REGISTRY[t].messagePrefix)
        return Object.values(evts).includes(msg.event)
      })
      if (!matchedType) return

      const config = JOB_TYPE_REGISTRY[matchedType]
      const evts = swEventNames(config.messagePrefix)

      if (msg.event === evts.started && config.toasts?.started) {
        toast.info(config.toasts.started(tRef.current))
      }

      if (
        msg.event === evts.succeeded ||
        msg.event === evts.failed ||
        msg.event === evts.stopped
      ) {
        if (msg.event === evts.succeeded && config.toasts?.succeeded) {
          toast.success(config.toasts.succeeded(tRef.current))
        } else if (msg.event === evts.failed && config.toasts?.failed) {
          toast.error(config.toasts.failed(tRef.current))
        }
        const failedJob = jobRecordsRef.current.find((r) => r.id === msg.id)
        const prevFolder = failedJob?.folder
        const prevParentId = failedJob?.parentId

        let fresh = await syncFromIndexedDB(`sw:${msg.event}`)

        if (msg.event === evts.failed && prevParentId) {
          await cancelPendingJobsByParentId(prevParentId)
          fresh = await syncFromIndexedDB(`sw:${msg.event}:cancel-siblings`)
        }

        if (prevFolder) tryAutoStart(matchedType, prevFolder, fresh)
        return
      }

      // started / removed → just re-sync
      await syncFromIndexedDB(`sw:${msg.event}`)
    }

    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [syncFromIndexedDB, tryAutoStart])

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

  useEffect(() => {
    if (!hasActiveJobs) return
    const id = setInterval(() => {
      void syncFromIndexedDB('poll')
    }, ACTIVE_JOB_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [hasActiveJobs, syncFromIndexedDB])

  // ---------------------------------------------------------------------------
  // Mount: register SW, startup reconciliation, initial auto-start
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    let detachSwUpdateChecks: (() => void) | undefined

    const activateServiceWorker = async (source: string) => {
      swRegistrationRef.current = await navigator.serviceWorker.ready
      await handleSwReactivate()
      const fresh = await syncFromIndexedDB(`activate:${source}`)
      swReadyRef.current = true
      setSwReady(true)
      tryAutoStartAll(fresh)
    }

    async function init() {
      if (!navigator.serviceWorker) {
        // No SW support — still sync so UI shows persisted jobs.
        await syncFromIndexedDB('init:no-sw')
        return
      }
      try {
        const registration = await navigator.serviceWorker.register(DOWNLOAD_SERVICE_WORKER_URL)
        if (cancelled) return

        // Wait for this page to be controlled (needed on first SW install when
        // clients.claim() hasn't fired yet — registration.active exists but
        // navigator.serviceWorker.controller may still be null).
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            const onChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', onChange)
              resolve()
            }
            navigator.serviceWorker.addEventListener('controllerchange', onChange)
            // Re-check in case the event already fired between the null check and listener add.
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.removeEventListener('controllerchange', onChange)
              resolve()
            }
          })
        }
        if (cancelled) return

        await activateServiceWorker('init')
        if (cancelled) return

        detachSwUpdateChecks = attachDownloadServiceWorkerUpdateChecks(registration, () => {
          if (cancelled) return
          void activateServiceWorker('sw-update')
        })
      } catch (e) {
        console.warn('[JobOrchestrator] SW registration failed', e)
        await syncFromIndexedDB('init:sw-register-failed')
      }
    }

    void init()
    return () => {
      cancelled = true
      detachSwUpdateChecks?.()
    }
  }, [handleSwReactivate, syncFromIndexedDB, tryAutoStartAll])

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
      if (!swReadyRef.current) return { started: false, reason: 'sw-not-ready' }

      const record = jobRecordsRef.current.find((r) => r.id === id)
      if (!record) return { started: false, reason: 'job-not-found' }

      const config = JOB_TYPE_REGISTRY[record.type]
      if (!config) return { started: false, reason: 'invalid-job-type' }

      if (!options?.forceStart) {
        const hasRunning = jobRecordsRef.current.some(
          (r) => r.type === record.type && r.folder === record.folder && r.status === 'running',
        )
        if (hasRunning) return { started: false, reason: 'concurrency-blocked' }
      }

      postSw(swEventNames(config.messagePrefix).start, id)
      return { started: true }
    },
    [postSw],
  )

  const stopJob = useCallback(
    (id: string): void => {
      const record = jobRecordsRef.current.find((r) => r.id === id)
      if (!record) return
      const config = JOB_TYPE_REGISTRY[record.type]
      if (!config) return
      postSw(`${config.messagePrefix}:stop`, id)
    },
    [postSw],
  )

  const removeJob = useCallback(
    async (id: string): Promise<void> => {
      const record = jobRecordsRef.current.find((r) => r.id === id)
      if (record) {
        const config = JOB_TYPE_REGISTRY[record.type]
        if (config) postSw(swEventNames(config.messagePrefix).remove, id)
      }
      await deleteJob(id)
      await syncFromIndexedDB('removeJob')
    },
    [postSw, syncFromIndexedDB],
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
      isReady: () => swReadyRef.current,
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
      isReady: swReady,
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
      swReady,
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
