import PQueue from "p-queue";
import { AbstractJob, type JobOptions, type JobStatus } from "./types";
import type { FolderType } from "@smm/types";

export interface ImportLibraryJobOptions extends JobOptions {
  libraryPath: string;
  type: FolderType;
  concurrency: number;
}

/** WIP: will orchestrate concurrent {@link ImportFolderJob} children. */
export class ImportLibraryJob extends AbstractJob {
  private readonly libraryPath: string;
  private readonly options: ImportLibraryJobOptions;

  constructor(options: ImportLibraryJobOptions) {
    super(options);
    this.libraryPath = options.libraryPath;
    this.options = options;
  }

  async run(): Promise<void> {
    const folderPaths: string[] = await this.fs.listSubdirectories(this.libraryPath);
    await this.log(`Found ${folderPaths.length} folders to import`);

    const queue = new PQueue({ concurrency: this.options.concurrency });
    for (const folderPath of folderPaths) {
      void queue.add(async () => {
        // TODO: construct ImportFolderJob with network / appDataDir / helpers and run it.
        void folderPath;
        void this.options.type;
      });
      await queue.onSizeLessThan(this.options.concurrency);
    }
    await queue.onIdle();
  }

  abort(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  status(): Promise<JobStatus> {
    throw new Error("Method not implemented.");
  }
}
