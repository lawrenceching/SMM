import PQueue from "p-queue";
import type { FolderType } from "@smm/types";
import type { AppContext, PlatformPorts } from "../types";
import { AbstractJob, type JobOptions } from "./abstract-job";
import { ImportFolderJob } from "./ImportFolderJob";
import { nextJobId } from "./jobManager";
import type { ImportLibraryJob as ImportLibraryJobSnapshot, ImportLibraryJobTask } from "./types";
import {
  createImportLibraryTasks,
  importLibraryJobProgress,
  patchImportLibraryTask,
} from "../pipeline/importLibrary";

export interface ImportLibraryJobOptions {
  libraryPath: string;
  type: FolderType;
  concurrency: number;
  skipInit: boolean;
  onMediaMetadataUpdated?: (folderPath: string) => void;
}

/** WIP: will orchestrate concurrent {@link ImportFolderJob} children. */
export class ImportLibraryJob extends AbstractJob {
  private readonly libraryPath: string;
  private readonly folderType: FolderType;
  private readonly concurrency: number;
  private readonly skipInit: boolean;
  private readonly onMediaMetadataUpdated: ((folderPath: string) => void) | undefined;
  private readonly callbacks: JobOptions["callbacks"];
  private tasks: ImportLibraryJobTask[] = [];
  private error: string | undefined;
  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(ctx: AppContext, ports: PlatformPorts, options: ImportLibraryJobOptions & JobOptions) {
    super(ctx, ports, {
      ...options,
      type: "import-library"
    });
    this.libraryPath = options.libraryPath;
    this.folderType = options.type;
    this.concurrency = options.concurrency;
    this.skipInit = options.skipInit;
    this.onMediaMetadataUpdated = options.onMediaMetadataUpdated;
    this.callbacks = options.callbacks;
  }

  /** Snapshot consumed by `POST /api/get-job` and UI job polling. */
  toJSON(): ImportLibraryJobSnapshot {
    return {
      id: this.id,
      libraryPath: this.libraryPath,
      type: "import-library",
      folderType: this.folderType,
      status: this.status === "aborted" ? "failed" : this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      progress: this.progress(),
      tasks: this.tasks,
      ...(this.error !== undefined ? { error: this.error } : {}),
    };
  }

  private patchTask(taskId: string, patch: Partial<ImportLibraryJobTask>): void {
    this.tasks = patchImportLibraryTask(this.tasks, taskId, patch);
    this.setProgress(importLibraryJobProgress(this.tasks));
    this.updatedAt = Date.now();
  }

  async run(): Promise<void> {
    this.setStatus("running");
    this.updatedAt = Date.now();
    if (!(await this.ports.fs.exists(this.libraryPath))) {
      const message = `Library path not found: ${this.libraryPath}`;
      this.error = message;
      await this.log(message);
      this.setStatus("failed");
      this.updatedAt = Date.now();
      return;
    }
    const folderPaths: string[] = await this.ports.fs.listSubdirectories(this.libraryPath);
    this.tasks = createImportLibraryTasks(this.id, folderPaths);
    this.setProgress(importLibraryJobProgress(this.tasks));
    this.updatedAt = Date.now();
    await this.log(`Found ${folderPaths.length} folders to import`);

    const queue = new PQueue({ concurrency: this.concurrency });
    for (const [index, folderPath] of folderPaths.entries()) {
      if(this.requestToAbort) {
        this.ports.logger.info({}, `Aborted the import-library job`);
        break;
      }
      const task = this.tasks[index];
      await queue.add(async () => {
        const job = new ImportFolderJob(this.context, this.ports, {
          id: nextJobId(),
          logDir: this.context.logDir,
          join: (...parts) => this.ports.fs.join(...parts),
          printLogToConsole: false,
          folderPath,
          type: this.folderType,
          skipInit: this.skipInit,
          onMediaMetadataUpdated: this.onMediaMetadataUpdated,
          callbacks: this.callbacks,
        });

        if (task !== undefined) {
          this.patchTask(task.id, { status: "running", importJobId: job.id });
        }
        await job.run();
        if (task !== undefined) {
          this.patchTask(task.id, {
            status: job.status === "failed" ? "failed" : "succeeded",
          });
        }
      });
      await queue.onSizeLessThan(this.concurrency);
    }
    await queue.onIdle();
    // Terminal "succeeded" is set by AbstractJob.start after the lifecycle footer.
    this.setProgress(importLibraryJobProgress(this.tasks));
    this.updatedAt = Date.now();
  }

  override abort(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
