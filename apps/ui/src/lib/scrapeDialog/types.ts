import type { MediaMetadata } from "@core/types"

export type ScrapeTaskId = "poster" | "fanart" | "thumbnails" | "nfo"

export type ScrapeTaskStatus = "pending" | "running" | "completed" | "failed"

export interface ScrapeTaskView {
  id: ScrapeTaskId
  status: ScrapeTaskStatus
  failedReason?: string
}

export interface ScrapeTaskState {
  tasks: ScrapeTaskView[]
  isRunning: boolean
}

export type ScrapeTaskAction =
  | { type: "INIT"; tasks: ScrapeTaskView[] }
  | { type: "SET_COMPLETION"; completion: Record<ScrapeTaskId, boolean> }
  | { type: "MARK_RUNNING"; id: ScrapeTaskId }
  | { type: "MARK_COMPLETED"; id: ScrapeTaskId }
  | { type: "MARK_FAILED"; id: ScrapeTaskId; reason?: string }
  | { type: "START_RUN" }
  | { type: "FINISH_RUN" }

export const SCRAPE_TASK_IDS: ScrapeTaskId[] = ["poster", "fanart", "thumbnails", "nfo"]

export function getScrapeTaskIdsForMedia(
  mediaMetadata: Pick<MediaMetadata, "type"> | undefined,
): ScrapeTaskId[] {
  if (mediaMetadata?.type === "movie-folder") {
    return SCRAPE_TASK_IDS.filter((id) => id !== "thumbnails")
  }
  return [...SCRAPE_TASK_IDS]
}

export function createInitialScrapeTasks(): ScrapeTaskView[] {
  return SCRAPE_TASK_IDS.map((id) => ({ id, status: "pending" }))
}

export function createInitialScrapeTasksForMedia(
  mediaMetadata: Pick<MediaMetadata, "type"> | undefined,
): ScrapeTaskView[] {
  return getScrapeTaskIdsForMedia(mediaMetadata).map((id) => ({ id, status: "pending" }))
}

export const INITIAL_SCRAPE_TASK_STATE: ScrapeTaskState = {
  tasks: [],
  isRunning: false,
}
