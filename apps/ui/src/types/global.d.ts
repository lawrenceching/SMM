import type { BackgroundJob } from './background-jobs'
import type { StartJobResult } from '@/components/JobOrchestratorProvider'

interface JobOrchestratorBridge {
  createJob(job: BackgroundJob): Promise<string>
  createJobs(jobs: BackgroundJob[]): Promise<{
    successIds: string[]
    failures: Array<{ job: BackgroundJob; error: string }>
  }>
  startJob(id: string, options?: { forceStart?: boolean }): Promise<StartJobResult>
  stopJob(id: string): void
  removeJob(id: string): Promise<void>
  markPendingAsAborted(id: string): Promise<void>
  isReady(): boolean
}

declare global {
  interface Window {
    __jobOrchestrator?: JobOrchestratorBridge
    /** E2E readiness: `not-ready` until all initializers finish; `error` if any failed. */
    _smm_status?: "not-ready" | "ready" | "error"
    /** Read-only snapshot of selected UIMediaFolderStore folder for e2e diagnostics. */
    __uiMediaFolderStore?: {
      getSelectedFolderSnapshot(): {
        path: string
        status:
          | "idle"
          | "pending_for_initialization"
          | "initializing"
          | "ok"
          | "folder_not_found"
          | "error_loading_metadata"
          | "loading"
          | "updating"
      } | null
    }
  }
}
