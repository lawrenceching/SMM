import type { MediaMetadata } from "@smm/types"
import type { ScrapeJob, ScrapeTaskRuntimeStatus } from "@/api/getJob"
import { normalizeScrapeTaskError } from "@/lib/scrapeError"
import {
  createInitialScrapeTasksForMedia,
  type ScrapeTaskId,
  type ScrapeTaskStatus,
  type ScrapeTaskView,
} from "./types"

function mapCoreTaskStatus(status: ScrapeTaskRuntimeStatus): ScrapeTaskStatus {
  if (status === "skipped") return "completed"
  if (status === "pending" || status === "running" || status === "completed" || status === "failed") {
    return status
  }
  return "pending"
}

export interface DeriveScrapeTasksInput {
  mediaMetadata?: Pick<MediaMetadata, "type">
  /** Local filesystem completion snapshot (pre-run). */
  completion?: Partial<Record<ScrapeTaskId, boolean>> | null
  /** Live / final scrape job from useJobQuery. */
  scrapeJob?: ScrapeJob | null
  /** Start-scrape mutation failure or unexpected job kind. */
  startError?: unknown | null
}

/**
 * Pure UI mapping: completion baseline ← overridden by scrape job ← overridden by start error
 * for still-pending/running rows.
 */
export function deriveScrapeTasks({
  mediaMetadata,
  completion,
  scrapeJob,
  startError,
}: DeriveScrapeTasksInput): ScrapeTaskView[] {
  const baseline = createInitialScrapeTasksForMedia(mediaMetadata).map((task) => ({
    ...task,
    status: (completion?.[task.id] ? "completed" : "pending") as ScrapeTaskStatus,
  }))

  if (scrapeJob) {
    return baseline.map((task) => {
      const next = scrapeJob.tasks[task.id]
      if (!next) return task
      return {
        id: task.id,
        status: mapCoreTaskStatus(next.status),
        failedReason: next.error,
      }
    })
  }

  if (startError != null) {
    const { messageKey, debugDetail } = normalizeScrapeTaskError(startError)
    return baseline.map((task) => {
      if (task.status !== "pending" && task.status !== "running") return task
      return {
        id: task.id,
        status: "failed" as const,
        failedReason: debugDetail.trim() ? messageKey : undefined,
      }
    })
  }

  return baseline
}
