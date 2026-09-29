import type { FolderType } from "@smm/types";
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import {
  IMPORT_FOLDER_COMPLETED,
  startedImportFolderMessage,
} from "./importFolderLog";
import { AbstractJob, type JobLogLevel, type JobOptions, type JobStatus } from "./types";
import {
  initializeFolder,
  persistNewFolder,
  type FolderInitializationDeps,
  type PersistNewFolderDeps,
} from "../pipeline/importFolderPipeline";

export interface ImportFolderJobOptions extends JobOptions, PersistNewFolderDeps {
  /** POSIX path used in log lines and the job record. */
  folderPath: string;
  /** Caller path passed to persist and recognition. Defaults to `folderPath`. */
  sourcePath?: string;
  type: FolderType;
  handle: JobHandle;
  /** When set, stage 1 was already done by the caller (import-library). */
  skipRegistration?: boolean;
  recognitionDeps: () => Promise<FolderInitializationDeps>;
  readStatus: () => JobStatus;
}

/**
 * Folder import: persist the folder, then recognize it and its episode files.
 * Log lines are appended to `${logDir}/${name}.log` (name is `job-${id}`).
 */
export class ImportFolderJob extends AbstractJob {
  private readonly folderPath: string;
  private readonly sourcePath: string;
  private readonly type: FolderType;
  private readonly handle: JobHandle;
  private readonly skipRegistration: boolean;
  private readonly persistDeps: PersistNewFolderDeps;
  private readonly recognitionDeps: () => Promise<FolderInitializationDeps>;
  private readonly readStatus: () => JobStatus;
  private readonly logDir: string;

  constructor(options: ImportFolderJobOptions) {
    super(options);
    this.folderPath = options.folderPath;
    this.sourcePath = options.sourcePath ?? options.folderPath;
    this.type = options.type;
    this.handle = options.handle;
    this.skipRegistration = options.skipRegistration === true;
    this.persistDeps = {
      userConfig: options.userConfig,
      mediaMetadata: options.mediaMetadata,
    };
    this.recognitionDeps = options.recognitionDeps;
    this.readStatus = options.readStatus;
    this.logDir = options.logDir;
  }

  /**
   * Stage 1. Returns false when persisting failed; the job is already marked failed.
   * `Core.importFolder` returns to the caller after this stage.
   */
  async persistFolder(): Promise<boolean> {
    await this.log(startedImportFolderMessage(this.folderPath, this.type));
    try {
      if (!this.skipRegistration) {
        this.logger.info(
          { folderPath: this.folderPath, type: this.type },
          "importFolder: stage=persistFolder",
        );
        await persistNewFolder(this.sourcePath, this.type, this.persistDeps);
      }
      this.handle.update({ stage: "persistFolder", progress: 10 });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logLine("error", message);
      this.handle.update({ status: "failed", error: message });
      return false;
    }
  }

  /** Marks a skipInit import finished without recognition. */
  async finishSkipInit(): Promise<void> {
    await this.log(IMPORT_FOLDER_COMPLETED);
    this.handle.update({ status: "succeeded", progress: 100 });
  }

  /** Stages 2 and 3. */
  override async run(): Promise<void> {
    this.handle.update({ status: "running" });
    try {
      this.handle.throwIfAborted();
      await initializeFolder(
        this.sourcePath,
        this.type,
        await this.recognitionDeps(),
        {
          onStage: (stage, progress, detail) => {
            this.handle.update({
              stage,
              progress,
              ...(detail?.title !== undefined ? { recognizedTitle: detail.title } : {}),
            });
          },
          throwIfAborted: () => this.handle.throwIfAborted(),
          appendLog: (_level, message) => this.log(message),
        },
      );
      await this.log(IMPORT_FOLDER_COMPLETED);
      this.handle.update({ status: "succeeded", stage: null, progress: 100 });
    } catch (error) {
      if (error instanceof JobAbortError) {
        await this.logLine("warn", "aborted");
        this.handle.update({ status: "aborted", error: "aborted" });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.logLine("error", message);
      this.handle.update({ status: "failed", error: message });
    }
  }

  override async abort(): Promise<void> {
    this.handle.requestStop();
  }

  override async status(): Promise<JobStatus> {
    return this.readStatus();
  }

  override async log(message: string): Promise<void> {
    await this.logLine("info", message);
  }

  private async logLine(level: JobLogLevel, message: string): Promise<void> {
    this.handle.appendLog(level, message);
    if (this.printLogToConsole) {
      this.logger.info({}, `[${this.name}] ${message}`);
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
      this.logger.warn({ err: error, jobId: this.handle.id }, "importFolder: failed to write job log file");
    }
  }
}
