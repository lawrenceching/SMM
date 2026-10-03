import PQueue from "p-queue";
import type { FolderType } from "@smm/types";
import type { AppContext, PlatformPorts } from "../types";
import { AbstractJob, type JobOptions } from "./abstract-job";
import { ImportFolderJob } from "./ImportFolderJob";
import { nextJobId } from "./jobManager";

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

  async run(): Promise<void> {
    this.setStatus("running");
    if (!(await this.ports.fs.exists(this.libraryPath))) {
      await this.log(`Library path not found: ${this.libraryPath}`);
      this.setStatus("failed");
      return;
    }
    const folderPaths: string[] = await this.ports.fs.listSubdirectories(this.libraryPath);
    await this.log(`Found ${folderPaths.length} folders to import`);

    const queue = new PQueue({ concurrency: this.concurrency });
    for (const folderPath of folderPaths) {
      if(this.requestToAbort) {
        this.ports.logger.info({}, `Aborted the import-library job`);
        break;
      }
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

        await job.run();
      });
      await queue.onSizeLessThan(this.concurrency);
    }
    await queue.onIdle();
    this.setStatus("succeeded");
  }

  override abort(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
