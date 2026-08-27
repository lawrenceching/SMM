import type { FolderType } from "@smm/core";
import type {
  ImportLibraryJob as ImportLibraryJobPayload,
  ImportLibraryJobTask,
} from "@smm/core/job/ImportLibraryJob";
import type { ScrapeTaskId } from "../pipeline/scrape/types";

export type { ImportLibraryJobTask } from "@smm/core/job/ImportLibraryJob";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
export type JobStage = "config" | "metadata" | "listFiles" | "recognize" | "episodes" | "persist" | null;

export interface ImportJob {
  kind: "import";
  id: string;
  folderPath: string;
  type: FolderType;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  /** Set after the recognize stage when a TV show or movie title is known. */
  recognizedTitle?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ImportLibraryJob extends ImportLibraryJobPayload {
  kind: "import-library";
}

export type ScrapeTaskRuntimeStatus =
  | "pending"
  | "running"
  | "skipped"
  | "completed"
  | "failed";

export interface ScrapeJobTask {
  status: ScrapeTaskRuntimeStatus;
  error?: string;
}

export interface ScrapeJob {
  kind: "scrape";
  id: string;
  folderPath: string;
  status: JobStatus;
  tasks: Record<ScrapeTaskId, ScrapeJobTask>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type Job = ImportJob | ImportLibraryJob | ScrapeJob;

export function initialScrapeTasks(): Record<ScrapeTaskId, ScrapeJobTask> {
  return {
    poster: { status: "pending" },
    fanart: { status: "pending" },
    thumbnails: { status: "pending" },
    nfo: { status: "pending" },
  };
}
