import type { FolderType } from "@smm/types";
import type {
  ImportLibraryJob as ImportLibraryJobPayload,
} from "@smm/types/job/ImportLibraryJob";
import type { ScrapeTaskId } from "../pipeline/scrape/types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";

export type { ImportLibraryJobTask } from "@smm/types/job/ImportLibraryJob";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
/** Folder initialization stages, see docs/dev/import-folder.md. */
export type JobStage = "persistFolder" | "recognizeFolder" | "recognizeEpisodes" | null;

export interface ImportJob {
  kind: "import";
  id: string;
  folderPath: string;
  type: FolderType;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  /** Set after the recognizeFolder stage when a TV show or movie title is known. */
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

export type JobLogLevel = "info" | "warn" | "error";

export interface JobLogLine {
  ts: number;
  level: JobLogLevel;
  message: string;
}


export interface JobOptions {
  name: string,
  logDir: string,
  join: (...args: string[]) => string,
  printLogToConsole: boolean,
  fs: FsPort,
  logger: LoggerPort
}

export abstract class AbstractJob {

  readonly name: string;
  readonly logFilePath: string;
  readonly printLogToConsole: boolean;
  readonly fs: FsPort;
  readonly logger: LoggerPort;

  constructor({ name, logDir, join, printLogToConsole, fs, logger }: JobOptions) {
    this.name = name
    this.logFilePath = join(logDir, `${this.name}.log`);
    this.printLogToConsole = printLogToConsole ?? false;
    this.fs = fs
    this.logger = logger
  }

  async start(): Promise<void> {
    await this.log(`${this.name} started`);
    await this.run();
    await this.log(`${this.name} completed`);
  }

  abstract run(): Promise<void>;

  abstract abort(): Promise<void>;

  abstract status(): Promise<JobStatus>;

  async log(message: string): Promise<void> {
    await this.fs.writeTextFile(this.logFilePath, message);
    if(this.printLogToConsole) {
      this.logger.info({}, `[${this.name}] ${message}`);
    }
  }
}