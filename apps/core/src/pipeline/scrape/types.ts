export type ScrapeTaskId = "poster" | "fanart" | "thumbnails" | "nfo";

export type ScrapeTaskStatus = "skipped" | "completed" | "failed";

export interface ScrapeTaskResult {
  status: ScrapeTaskStatus;
  error?: string;
}

export interface ScrapeFolderResult {
  mediaFolderPath: string;
  tasks: Record<ScrapeTaskId, ScrapeTaskResult>;
}
