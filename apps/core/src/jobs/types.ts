import type { FolderType } from "@smm/types";
import type {
  ImportLibraryJob as ImportLibraryJobPayload,
} from "@smm/types/job/ImportLibraryJob";
import type { ScrapeTaskId } from "../pipeline/scrape/types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { AppContext, PlatformPorts } from "../types";

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
  id: string;
  logDir: string;
  join: (...args: string[]) => string;
  printLogToConsole: boolean;
  context: AppContext;
  ports: PlatformPorts;
  type: string;
}

export abstract class AbstractJob {

  readonly id: string;
  readonly logDir: string;
  readonly logFilePath: string;
  readonly printLogToConsole: boolean;
  readonly context: AppContext;
  readonly ports: PlatformPorts;
  readonly fs: FsPort;
  readonly logger: LoggerPort;
  readonly type: string;
  private _progress: number = 0;

  constructor({ id: id, logDir, join, printLogToConsole, context, ports, type }: JobOptions) {
    this.id = id;
    this.logDir = logDir;
    this.logFilePath = join(logDir, `${this.id}.log`);
    this.printLogToConsole = printLogToConsole ?? false;
    this.context = context;
    this.ports = ports;
    this.fs = ports.fs;
    this.logger = ports.logger;
    this.type = type;
  }

  protected setProgress(progress: number): void {
    if(progress < 0) {
      progress = 0;
    }
    if(progress > 100) {
      progress = 100;
    }
    this._progress = progress;
  }

  public progress(): number {
    return this._progress;
  }

  async start(): Promise<void> {
    await this.log(`${this.id} started`);
    this.setProgress(0);
    await this.run();
    this.setProgress(100);
    await this.log(`${this.id} completed`);
  }

  abstract run(): Promise<void>;

  abstract abort(): Promise<void>;

  abstract status(): Promise<JobStatus>;

  /** Appends a job log line to the log file (and optionally the console). */
  async log(message: string): Promise<void> {
    if (this.printLogToConsole) {
      this.logger.info({}, `[${this.id}] ${message}`);
    }
    if (!this.logDir) return;
    try {
      let prev = "";
      if (await this.fs.exists(this.logFilePath)) {
        prev = await this.fs.readTextFile(this.logFilePath);
      }
      const prefix = prev.length === 0 || prev.endsWith("\n") ? prev : `${prev}\n`;
      await this.fs.writeTextFile(this.logFilePath, `${prefix}${message}\n`);
    } catch (error) {
      this.logger.warn({ err: error, name: this.id }, "job: failed to write job log file");
    }
  }
}
