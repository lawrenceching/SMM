import { Path } from "@core/path";
import type { AppConfig, FolderType, MediaMetadata, UserConfig as UserConfigData } from "@smm/core";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import type { LoggerPort } from "./ports/LoggerPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./pipeline/importFolderPipeline";
import { metadataCachePath } from "./pipeline/paths";
import { UserConfig } from "./pipeline/userConfig";
import { JobStore } from "./jobs/jobStore";
import type { ImportJob } from "./jobs/types";

export interface CoreOptions {
  fs: FsPort;
  network: NetworkPort;
  logger?: LoggerPort;
  /** Root directory holding smm.json and metadata/. */
  appDataDir: string;
  /** App version string (e.g. "1.3.8"); getAppConfig() falls back to "". */
  version?: string;
  /** Reverse proxy base URL; getAppConfig() falls back to null. */
  reverseProxyUrl?: string | null;
  /** userDataDir reported by getAppConfig(); falls back to appDataDir. */
  userDataDir?: string;
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
  private readonly version: string;
  private readonly reverseProxyUrl: string | null;
  private readonly userDataDir: string;
  private readonly userConfig: UserConfig;

  constructor(options: CoreOptions) {
    this.fs = options.fs;
    this.network = options.network;
    this.logger = options.logger ?? new NoopLoggerAdapter();
    this.appDataDir = options.appDataDir;
    this.version = options.version ?? "";
    this.reverseProxyUrl = options.reverseProxyUrl ?? null;
    this.userDataDir = options.userDataDir ?? options.appDataDir;
    this.userConfig = new UserConfig(this.fs, this.appDataDir);
  }

  /** Starts the import pipeline in the background; returns a job handle immediately. */
  importFolder(path: string, type: FolderType): ImportFolderHandle {
    const folderPath = this.normalizePosix(path);
    const job = this.jobs.create({
      folderPath,
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

  /** Application-level config (version / userDataDir / reverseProxyUrl); never touches fs. */
  getAppConfig(): AppConfig {
    return {
      version: this.version,
      userDataDir: this.userDataDir,
      reverseProxyUrl: this.reverseProxyUrl,
    };
  }

  getUserConfig(): Promise<UserConfigData> {
    return this.userConfig.read();
  }

  async getFolders(): Promise<string[]> {
    return (await this.userConfig.read()).folders;
  }

  /** Reads the persisted metadata cache for a folder; null when absent or corrupt. */
  async getMediaMetadata(folder: string): Promise<MediaMetadata | null> {
    const posixPath = this.normalizePosix(folder);
    const cachePath = metadataCachePath(this.appDataDir, posixPath);
    if (!(await this.fs.exists(cachePath))) return null;
    try {
      const content = await this.fs.readTextFile(cachePath);
      return JSON.parse(content) as MediaMetadata;
    } catch {
      return null;
    }
  }

  /** Removes a folder from the user config and deletes its metadata cache. Idempotent. */
  async unimportFolder(path: string): Promise<void> {
    const posixPath = this.normalizePosix(path);
    let removed = false;
    await this.userConfig.update((config) => {
      const folders = config.folders.filter((f) => this.normalizePosix(f) !== posixPath);
      if (folders.length === config.folders.length) return config;
      removed = true;
      return { ...config, folders };
    });
    if (removed) {
      await this.fs.deleteFile(metadataCachePath(this.appDataDir, posixPath));
    }
  }

  private normalizePosix(path: string): string {
    try {
      return Path.posix(path);
    } catch {
      return path;
    }
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
