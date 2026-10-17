import type { FolderType } from "@smm/types";
import type {
  ImportLibraryJob as ImportLibraryJobPayload,
} from "@smm/types/job/ImportLibraryJob";
import type { ScrapeTaskId } from "../pipeline/scrape/types";

export type { ImportLibraryJobTask } from "@smm/types/job/ImportLibraryJob";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
/** Folder initialization stages, see docs/dev/import-folder.md. */
export type JobStage = "persistFolder" | "recognizeFolder" | "recognizeEpisodes" | null;

export interface ImportJob {
  kind: "import";
  id: string;
  folderPath: string;
  type: "import-folder";
  folderType: FolderType;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  /** Set after the recognizeFolder stage when a TV show or movie title is known. */
  recognizedTitle?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type ImportLibraryJob = ImportLibraryJobPayload;

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

/** Serialized scrape job returned by `POST /api/get-job`. */
export interface ScrapeJobSnapshot {
  kind: "scrape";
  id: string;
  folderPath: string;
  status: JobStatus;
  tasks: Record<ScrapeTaskId, ScrapeJobTask>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** Serialized yt-dlp download job returned by `getJob` / `listJobs`. */
export interface YtdlpJobSnapshot {
  kind: "ytdlp";
  id: string;
  type: "ytdlp";
  url: string;
  title?: string;
  folder: string;
  status: JobStatus;
  /** 0–100 for this single URL download. */
  progress: number;
  speedBps?: number;
  etaSeconds?: number | null;
  errorType?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TranscribeSubtitleJobSnapshot {
  kind: "transcribe-subtitle";
  id: string;
  type: "transcribe-subtitle";
  folder: string;
  mediaPath: string;
  title?: string;
  asr: string;
  language?: string;
  wordTimestamps?: boolean;
  format?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TranslateSubtitleJobSnapshot {
  kind: "translate-subtitle";
  id: string;
  type: "translate-subtitle";
  folder: string;
  subtitlePath: string;
  mediaPath?: string;
  title?: string;
  translator: string;
  targetLanguage: string;
  reflect?: boolean;
  layout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SynthesizeSubtitleJobSnapshot {
  kind: "synthesize-subtitle";
  id: string;
  type: "synthesize-subtitle";
  folder: string;
  videoPath: string;
  subtitlePath: string;
  title?: string;
  subtitleMode?: string;
  quality?: string;
  style?: string;
  renderMode?: string;
  layout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessSubtitleJobSnapshot {
  kind: "process-subtitle";
  id: string;
  type: "process-subtitle";
  folder: string;
  mediaPath: string;
  title?: string;
  asr?: string;
  language?: string;
  wordTimestamps?: boolean;
  format?: string;
  noOptimize?: boolean;
  noSplit?: boolean;
  noTranslate?: boolean;
  translator?: string;
  targetLanguage?: string;
  reflect?: boolean;
  layout?: string;
  prompt?: string;
  noSynthesize?: boolean;
  subtitleMode?: string;
  quality?: string;
  style?: string;
  renderMode?: string;
  synthesizeLayout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type Job =
  | ImportJob
  | ImportLibraryJob
  | ScrapeJobSnapshot
  | YtdlpJobSnapshot
  | TranscribeSubtitleJobSnapshot
  | TranslateSubtitleJobSnapshot
  | SynthesizeSubtitleJobSnapshot
  | ProcessSubtitleJobSnapshot;

export function initialScrapeTasks(): Record<ScrapeTaskId, ScrapeJobTask> {
  return {
    poster: { status: "pending" },
    fanart: { status: "pending" },
    thumbnails: { status: "pending" },
    nfo: { status: "pending" },
  };
}

export type JobLogLevel = "info" | "warn" | "error";

export interface JobLogLine {
  ts: number;
  level: JobLogLevel;
  message: string;
}
