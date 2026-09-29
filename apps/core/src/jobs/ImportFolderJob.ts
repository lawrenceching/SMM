import { Path } from "@smm/utils/path";
import type { FolderType } from "@smm/types";
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import {
  IMPORT_FOLDER_COMPLETED,
  startedImportFolderMessage,
} from "./importFolderLog";
import { AbstractJob, type JobOptions, type JobStatus } from "./types";
import {
  persistNewFolder,
  recognizeImportedEpisodes,
  recognizeImportedFolder,
  type PersistNewFolderDeps,
  type RecognizeImportedEpisodesRequest,
  type RecognizeImportedFolderRequest,
} from "../pipeline/importFolderPipeline";

export interface ImportFolderJobOptions extends JobOptions, PersistNewFolderDeps {
  /** Caller path used in log lines, the job record, persist, and recognition. */
  folderPath: string;
  type: FolderType;
  handle: JobHandle;
  readStatus: () => JobStatus;
  onMediaMetadataUpdated?: (folderPath: string) => void;
}

interface Step {
  name: string;
  run(job: ImportFolderJob): Promise<void>;
}

/**
 * Folder import: persist the folder, then recognize it and its episode files.
 * Log lines are appended to `${logDir}/${name}.log` (name is `job-${id}`).
 */
export class ImportFolderJob extends AbstractJob {
  private readonly folderPath: string;
  private readonly folderType: FolderType;
  private readonly handle: JobHandle;
  private readonly persistDeps: PersistNewFolderDeps;
  private readonly readStatus: () => JobStatus;
  private readonly onMediaMetadataUpdated: ((folderPath: string) => void) | undefined;

  /** Cached for recognition steps within a single `run()`. */
  private filePaths: string[] = [];

  constructor(options: ImportFolderJobOptions) {
    super({
      ...options,
      type: "import-folder"
    });
    this.folderPath = options.folderPath;
    this.folderType = options.type;
    this.handle = options.handle;
    this.persistDeps = {
      userConfig: options.userConfig,
      mediaMetadata: options.mediaMetadata,
    };
    this.readStatus = options.readStatus;
    this.onMediaMetadataUpdated = options.onMediaMetadataUpdated;
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
      this.handle.update({ status: "failed", error: message });
      return false;
    }
  }

  /** Marks a skipInit import finished without recognition. */
  async finishSkipInit(): Promise<void> {
    await this.log(IMPORT_FOLDER_COMPLETED);
    this.handle.update({ status: "succeeded", progress: 100 });
  }

  /**
   * Runs Steps after stage 1 (already done by {@link persistFolder}).
   * Music has no further steps; tvshow/movie recognize folder then episodes.
   */
  override async run(): Promise<void> {
    const steps = this.steps();

    this.handle.update({ status: "running" });
    try {
      this.handle.throwIfAborted();
      const posixPath = this.ports.normalizePosix(this.folderPath);
      this.filePaths = (await this.fs.listFiles(posixPath)).map((file) => Path.posix(file));

      for (const step of steps) {
        this.handle.throwIfAborted();
        this.logger.info({ step: step.name, folderPath: this.folderPath }, "importFolder: step");
        await step.run(this);
        this.setProgress(this.progress() + 100 / steps.length);
      }

      await this.log(IMPORT_FOLDER_COMPLETED);
      this.handle.update({ status: "succeeded", stage: null, progress: 100 });
    } catch (error) {
      if (error instanceof JobAbortError) {
        await this.log("aborted");
        this.handle.update({ status: "aborted", error: "aborted" });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.log(message);
      this.handle.update({ status: "failed", error: message });
    } finally {
      this.filePaths = [];
    }
  }

  override async abort(): Promise<void> {
    this.handle.requestStop();
  }

  override async status(): Promise<JobStatus> {
    return this.readStatus();
  }

  /** Also mirrors lines into the in-memory job log via {@link JobHandle.appendLog}. */
  override async log(message: string): Promise<void> {
    this.handle.appendLog("info", message);
    await super.log(message);
  }

  /** Full step lists matching the import-folder stage model. */
  private steps(): Step[] {
    const persistStep: Step = {
      name: "create blank metadata and save folder to user config",
      async run(job: ImportFolderJob): Promise<void> {
        job.logger.info(
          { folderPath: job.folderPath, type: job.folderType },
          "importFolder: stage=persistFolder",
        );
        await persistNewFolder(job.folderPath, job.folderType, job.persistDeps);
        job.handle.update({ stage: "persistFolder", progress: 10 });
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
            ...job.stageCallbacks(),
          };
          await recognizeImportedFolder(req, job.context, job.ports, job.onMediaMetadataUpdated);
        },
      },
      {
        name: "recognize episode files",
        async run(job: ImportFolderJob): Promise<void> {
          const req: RecognizeImportedEpisodesRequest = {
            folderPath: job.folderPath,
            filePaths: job.filePaths,
            ...job.stageCallbacks(),
          };
          await recognizeImportedEpisodes(req, job.context, job.ports, job.onMediaMetadataUpdated);
        },
      },
    ];

    const stepsForMusic: Step[] = [persistStep];

    return this.folderType === "tvshow" || this.folderType === "movie"
      ? stepsForTvShowAndMovieFolder
      : stepsForMusic;
  }

  private stageCallbacks(): Pick<
    RecognizeImportedFolderRequest,
    "onStage" | "throwIfAborted" | "appendLog"
  > {
    return {
      onStage: (stage, progress, detail) => {
        this.handle.update({
          stage,
          progress,
          ...(detail?.title !== undefined ? { recognizedTitle: detail.title } : {}),
        });
      },
      throwIfAborted: () => this.handle.throwIfAborted(),
      appendLog: (_level, message) => this.log(message),
    };
  }
}
