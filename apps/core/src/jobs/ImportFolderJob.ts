import { Path } from "@smm/utils/path";
import type { FolderType } from "@smm/types";
import { JobAbortError } from "./jobAbortError";
import { importJobLogFileName, startedImportFolderMessage } from "./importFolderLog";
import { AbstractJob, type JobOptions } from "./abstract-job";
import {
  persistNewFolder,
  recognizeImportedEpisodes,
  recognizeImportedFolder,
  type AppContext,
  type PlatformPorts,
  type RecognizeImportedEpisodesRequest,
  type RecognizeImportedFolderRequest,
} from "../pipeline/importFolderPipeline";
import type { ImportJob } from "./types";
import { MediaMetadataHelper } from "../pipeline/mediaMetadataHelper";

export interface ImportFolderJobOptions {
  /** Caller path used in log lines, the job record, persist, and recognition. */
  folderPath: string;
  type: FolderType;
  skipInit: boolean;
  onMediaMetadataUpdated?: (folderPath: string) => void;
}

interface Step {
  name: string;
  run(job: ImportFolderJob): Promise<void>;
}

/**
 * Folder import: persist the folder, then recognize it and its episode files.
 * Log lines are appended to `${logDir}/job-${id}.log`.
 */
export class ImportFolderJob extends AbstractJob {
  private readonly folderPath: string;
  private readonly folderType: FolderType;
  private readonly skipInit: boolean;
  private readonly onMediaMetadataUpdated: ((folderPath: string) => void) | undefined;

  /** Cached for recognition steps within a single `run()`. */
  private filePaths: string[] = [];
  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(ctx: AppContext, ports: PlatformPorts, options: ImportFolderJobOptions & JobOptions) {
    super(ctx, ports, {
      ...options,
      type: "import-folder",
      logFileName: importJobLogFileName(options.id),
    });
    this.folderPath = options.folderPath;
    this.folderType = options.type;
    this.skipInit = options.skipInit;
    this.onMediaMetadataUpdated = options.onMediaMetadataUpdated;
  }

  /** Snapshot consumed by `POST /api/get-job` and UI job polling. */
  toJSON(): ImportJob {
    return {
      kind: "import",
      id: this.id,
      folderPath: this.folderPath,
      type: "import-folder",
      folderType: this.folderType,
      status: this.status,
      stage: null,
      progress: this.progress(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Stage 1. Runs the first Step ("create blank metadata…").
   * Returns false when persisting failed; the job is already marked failed.
   * `Core.importFolder` returns to the caller after this stage.
   */
  async persistFolder(): Promise<boolean> {
    await this.log(startedImportFolderMessage(this.folderPath, this.folderType));
    try {
      const [persistStep] = this.steps();
      await persistStep!.run(this);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.log(message);
      return false;
    }
  }

  /**
   * Runs Steps after stage 1 (already done by {@link persistFolder}).
   * Music has no further steps; tvshow/movie recognize folder then episodes.
   */
  override async run(): Promise<void> {
    this.setStatus("running");
    const steps = this.steps();

    try {

      const msg = `Started to import folder: ${this.folderPath}, type: ${this.folderType}`
      this.ports.logger.info({}, msg);
      await this.log(msg);

      if (this.skipInit) {
        const [persistStep] = steps;
        await persistStep!.run(this);
        // Terminal "succeeded" is set by AbstractJob.start after the lifecycle footer.
        return;
      }

      this.filePaths = (await this.ports.fs.listFiles(this.folderPath)).map((file) => Path.posix(file));

      if(this.requestToAbort) {
        this.setStatus("aborted");
        return;
      }

      for (const step of steps) {
        this.ports.logger.info({ step: step.name, folderPath: this.folderPath }, "importFolder: step");
        await step.run(this);
        this.setProgress(this.progress() + 100 / steps.length);
        if(this.requestToAbort) {
          this.setStatus("aborted");
          return;
        }
      }

      // Terminal "succeeded" is set by AbstractJob.start after the lifecycle footer.
    } catch (error) {
      this.setStatus("failed");
      if (error instanceof JobAbortError) {
        await this.log("aborted");

        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.log(message);
    } finally {
      this.filePaths = [];
    }
  }

  override async abort(): Promise<void> {
  }


  /** Also mirrors lines into the in-memory job log via {@link JobHandle.appendLog}. */
  override async log(message: string): Promise<void> {
    await super.log(message);
  }

  /** Full step lists matching the import-folder stage model. */
  private steps(): Step[] {
    const persistStep: Step = {
      name: "create blank metadata and save folder to user config",
      async run(job: ImportFolderJob): Promise<void> {
        job.ports.logger.info(
          { folderPath: job.folderPath, type: job.folderType },
          "importFolder: stage=persistFolder",
        );
        await persistNewFolder(
          job.folderPath,
          job.folderType,
          job.context,
          job.ports,
          job.onMediaMetadataUpdated,
        );
      },
    };

    const stepsForTvShowAndMovieFolder: Step[] = [
      persistStep,
      {
        name: "recognize folder",
        async run(job: ImportFolderJob): Promise<void> {
          const req: RecognizeImportedFolderRequest = {
            folderPath: job.folderPath,
            filePaths: job.filePaths,
          };
          await recognizeImportedFolder(req, job.context, job.ports, job.onMediaMetadataUpdated);
          const helper = new MediaMetadataHelper(job.ports.fs, job.context.appDataDir, job.onMediaMetadataUpdated);
          const mm = await helper.read(job.folderPath);

          const name = mm?.tvShow?.name ?? mm?.movie?.name ?? 'undefined';
          const id = mm?.tvShow?.id ?? mm?.movie?.id ?? 'undefined';
          const db: string = (mm?.tvShow?.database ?? mm?.movie?.database ?? 'undefined').toLocaleLowerCase();

          const msg = `Recognize ${job.folderPath}: ${name} (${db}Id:${id})`
          job.ports.logger.info({}, msg);
          await job.log(msg);
        },
      },
      {
        name: "recognize episode files",
        async run(job: ImportFolderJob): Promise<void> {
          const req: RecognizeImportedEpisodesRequest = {
            folderPath: job.folderPath,
            filePaths: job.filePaths,
          };
          await recognizeImportedEpisodes(req, job.context, job.ports, job.onMediaMetadataUpdated);


          const helper = new MediaMetadataHelper(job.ports.fs, job.context.appDataDir, job.onMediaMetadataUpdated);
          const mm = await helper.read(job.folderPath);          
          const recognizedFilesNumber = mm?.mediaFiles?.length ?? 0;
          const msg = `Recognize ${recognizedFilesNumber} episode files`
          job.ports.logger.info({}, msg);
          await job.log(msg);

        },
      },
    ];

    const stepsForMusic: Step[] = [persistStep];

    return this.folderType === "tvshow" || this.folderType === "movie"
      ? stepsForTvShowAndMovieFolder
      : stepsForMusic;
  }

}
