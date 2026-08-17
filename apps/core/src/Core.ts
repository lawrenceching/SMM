import { Path } from "@core/path";
import type { FolderType } from "@smm/core";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import type { LoggerPort } from "./ports/LoggerPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./pipeline/importFolderPipeline";
import { JobStore } from "./jobs/jobStore";
import type { ImportJob } from "./jobs/types";

export interface CoreOptions {
  fs: FsPort;
  network: NetworkPort;
  logger?: LoggerPort;
  /** Root directory holding smm.json and metadata/. */
  appDataDir: string;
}

export interface ImportFolderHandle {
  id: string;
}

export class Core {
  private readonly jobs = new JobStore();
  private readonly fs: FsPort;
  private readonly network: NetworkPort;
  private readonly logger: LoggerPort;
  private readonly appDataDir: string;

  constructor(options: CoreOptions) {
    this.fs = options.fs;
    this.network = options.network;
    this.logger = options.logger ?? new NoopLoggerAdapter();
    this.appDataDir = options.appDataDir;
  }

  /** Starts the import pipeline in the background; returns a job handle immediately. */
  importFolder(path: string, type: FolderType): ImportFolderHandle {
    const job = this.jobs.create({
      folderPath: Path.posix(path),
      type,
      status: "running",
      stage: "config",
      progress: 0,
    });
    void this.runImport(job, path, type);
    return { id: job.id };
  }

  getJob(id: string): ImportJob | undefined {
    return this.jobs.get(id);
  }

  private async runImport(job: ImportJob, folderPath: string, type: FolderType): Promise<void> {
    try {
      const pipeline = new ImportFolderPipeline({
        fs: this.fs,
        network: this.network,
        logger: this.logger,
        appDataDir: this.appDataDir,
      });
      await pipeline.run(folderPath, type, {
        onStage: (stage, progress) => {
          this.jobs.update(job.id, { stage, progress });
        },
      });
      this.jobs.update(job.id, { status: "succeeded", stage: null, progress: 100 });
    } catch (error) {
      this.jobs.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
