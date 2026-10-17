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
  prepareLibraryFoldersForImport,
} from "../pipeline/importLibrary";
import { MediaMetadataHelper } from "../pipeline/mediaMetadataHelper";
import { UserConfigHelper } from "../pipeline/userConfigHelper";
import { uniq } from "es-toolkit/array";

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
  private tasks: ImportLibraryJobTask[] = [];
  private error: string | undefined;
  private readonly createdAt = Date.now();
  private updatedAt = Date.now();
  /** Serializes log file writes under concurrent child ImportFolderJob logging. */
  private logWriteChain: Promise<void> = Promise.resolve();
  /** In-flight child imports; aborted when {@link abort} runs. */
  private activeChildren: ImportFolderJob[] = [];

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
  }

  /**
   * Serialize appends so concurrent child {@link ImportFolderJob} logs do not
   * clobber each other (AbstractJob.log is read-modify-write).
   */
  override async log(message: string): Promise<void> {
    this.logWriteChain = this.logWriteChain.then(
      () => super.log(message),
      () => super.log(message),
    );
    await this.logWriteChain;
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

    // Notify smm.json earlier so that the UI can show the folder list immediately
    const folderPaths: string[] = await this.ports.fs.listSubdirectories(this.libraryPath);

    // Blank metadata must exist before folders are listed in smm.json so the UI
    // does not show a "No Media Metadata" warning. MediaMetadataHelper notifies
    // onMediaMetadataUpdated (Core → mediaMetadataUpdated → Socket.IO → UI).
    const userConfigHelper = new UserConfigHelper(this.ports.fs, this.context.userDataDir);
    const mediaMetadata = new MediaMetadataHelper(
      this.ports.fs,
      this.context.appDataDir,
      this.onMediaMetadataUpdated,
    );
    await prepareLibraryFoldersForImport(folderPaths, this.folderType, {
      writeBlankMetadata: async (metadata) => {
        await mediaMetadata.createIfAbsent(metadata);
      },
      upsertFolders: async (folders) => {
        const existing = await userConfigHelper.getFolders();
        await userConfigHelper.setFolders(uniq([...existing, ...folders]));
      },
    });

    this.updatedAt = Date.now();
    if (!(await this.ports.fs.exists(this.libraryPath))) {
      const message = `Library path not found: ${this.libraryPath}`;
      this.error = message;
      await this.log(message);
      this.setStatus("failed");
      this.updatedAt = Date.now();
      return;
    }

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
        if (this.requestToAbort) {
          return;
        }
        const job = new ImportFolderJob(this.context, this.ports, {
          id: nextJobId(),
          logDir: this.context.logDir,
          join: (...parts) => this.ports.fs.join(...parts),
          printLogToConsole: false,
          folderPath,
          type: this.folderType,
          skipInit: this.skipInit,
          onMediaMetadataUpdated: this.onMediaMetadataUpdated,
          // Mirror every child log line into this library job's log file.
          callbacks: {
            onLog: (message) => this.log(message),
          },
        });

        if (task !== undefined) {
          this.patchTask(task.id, { status: "running", importJobId: job.id });
        }
        this.activeChildren.push(job);
        try {
          await job.run();
        } finally {
          this.activeChildren = this.activeChildren.filter((c) => c !== job);
        }
        if (task !== undefined) {
          this.patchTask(task.id, {
            status: job.status === "failed" || job.status === "aborted" ? "failed" : "succeeded",
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

  /** Cooperative stop: flag + abort any in-flight child {@link ImportFolderJob}. */
  override async abort(): Promise<void> {
    for (const child of [...this.activeChildren]) {
      child.tryAbort();
      await child.abort();
    }
  }
}
