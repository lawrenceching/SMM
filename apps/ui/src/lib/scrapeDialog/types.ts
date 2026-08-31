import type { MediaMetadata } from "@smm/types"

export type ScrapeTaskId = "poster" | "fanart" | "thumbnails" | "nfo"

export type ScrapeTaskStatus = "pending" | "running" | "completed" | "failed"

export interface ScrapeTaskView {
  id: ScrapeTaskId
  status: ScrapeTaskStatus
  failedReason?: string
}

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
