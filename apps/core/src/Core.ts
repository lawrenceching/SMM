import { Path } from "@core/path";
import type { AppConfig, FolderType, MediaMetadata, UserConfig as UserConfigData } from "@smm/core";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import type { LoggerPort } from "./ports/LoggerPort";
import type { DiscoverPort } from "./ports/DiscoverPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./pipeline/importFolderPipeline";
import { metadataCachePath } from "./pipeline/paths";
import { renameFolderPipeline, type RenameFolderArgs } from "./pipeline/renameFolder";
import { applyPlanPipeline } from "./pipeline/applyPlan";
import { readPlan, type Plan } from "./pipeline/plans";
import { tryToRecognizeFolderPipeline } from "./pipeline/tryToRecognizeFolder";
import { tryToRenameFolderPipeline } from "./pipeline/tryToRenameFolder";
import {
  scrapeFolderPipeline,
  type ScrapeFolderOptions,
} from "./pipeline/scrape/scrapeFolder";
import type { ScrapeFolderResult } from "./pipeline/scrape/types";
import type { RenameRuleName } from "./pipeline/renameRules";
import { isUserConfigKey, UserConfig } from "./pipeline/userConfig";
import { JobStore } from "./jobs/jobStore";
import type { ImportJob } from "./jobs/types";

export type { RenameFolderArgs, ScrapeFolderOptions, ScrapeFolderResult };

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
  /** Discover hosts for TMDB/TVDB failover. */
  discover?: DiscoverPort;
}

export interface ImportFolderHandle {
  id: string;
}

export interface ImportFolderOptions {
  /** When true, only register the path in UserConfig.folders; skip recognition and metadata. */
  skipInit?: boolean;
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
  private readonly discover?: DiscoverPort;

  constructor(options: CoreOptions) {
    this.fs = options.fs;
    this.network = options.network;
    this.logger = options.logger ?? new NoopLoggerAdapter();
    this.appDataDir = options.appDataDir;
    this.version = options.version ?? "";
    this.reverseProxyUrl = options.reverseProxyUrl ?? null;
    this.userDataDir = options.userDataDir ?? options.appDataDir;
    this.userConfig = new UserConfig(this.fs, this.appDataDir);
    this.discover = options.discover;
  }

  /** Starts the import pipeline in the background; returns a job handle immediately. */
  importFolder(path: string, type: FolderType, options?: ImportFolderOptions): ImportFolderHandle {
    const folderPath = this.normalizePosix(path);
    const job = this.jobs.create({
      folderPath,
      type,
      status: "running",
      stage: "config",
      progress: 0,
    });
    if (options?.skipInit === true) {
      void this.runImportSkipInit(job, path);
    } else {
      void this.runImport(job, path, type);
    }
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

  /** Updates one known UserConfig key. Rejects unknown keys without writing. */
  async setUserConfigKey(key: string, value: unknown): Promise<UserConfigData> {
    if (!isUserConfigKey(key)) {
      throw new Error(`Unknown config key: ${key}`);
    }
    return this.userConfig.update((config) => ({ ...config, [key]: value }));
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

  /** Writes the metadata cache for `mm.mediaFolderPath`. Strips `files`. Full replace. */
  async setMetadata(mm: MediaMetadata): Promise<void> {
    if (!mm.mediaFolderPath) {
      throw new Error("Media folder path is required");
    }
    const posixPath = this.normalizePosix(mm.mediaFolderPath);
    const { files: _files, ...toPersist } = mm;
    await this.fs.writeTextFile(
      metadataCachePath(this.appDataDir, posixPath),
      JSON.stringify(toPersist, null, 2),
    );
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

  async renameFolder(args: RenameFolderArgs): Promise<void> {
    await renameFolderPipeline(args, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (path) => this.normalizePosix(path),
    });
  }

  async tryToRecognizeFolder(path: string): Promise<RecognizeMediaFilePlan> {
    return tryToRecognizeFolderPipeline(path, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
    });
  }

  async tryToRenameFolder(path: string, rule?: RenameRuleName): Promise<RenameFilesPlan> {
    return tryToRenameFolderPipeline(path, rule, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
    });
  }

  async getPlan(id: string): Promise<Plan> {
    const plan = await readPlan(this.fs, this.appDataDir, id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    return plan;
  }

  async applyPlan(plan: Plan): Promise<void> {
    await applyPlanPipeline(plan, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      normalizePosix: (p) => this.normalizePosix(p),
      setMetadata: (mm) => this.setMetadata(mm),
      getMediaMetadata: (folder) => this.getMediaMetadata(folder),
    });
  }

  async scrapeFolder(path: string, options?: ScrapeFolderOptions): Promise<ScrapeFolderResult> {
    return scrapeFolderPipeline(path, options, {
      fs: this.fs,
      network: this.network,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
      discover: this.discover,
      reverseProxyUrl: this.reverseProxyUrl,
    });
  }

  private normalizePosix(path: string): string {
    try {
      return Path.posix(path);
    } catch {
      return path;
    }
  }

  private async runImportSkipInit(job: ImportJob, folderPath: string): Promise<void> {
    try {
      await this.userConfig.update((config) => ({
        ...config,
        folders: [...new Set([...config.folders, folderPath])],
      }));
      this.jobs.update(job.id, { status: "succeeded", stage: "config", progress: 100 });
    } catch (error) {
      this.jobs.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runImport(job: ImportJob, folderPath: string, type: FolderType): Promise<void> {
    try {
      const pipeline = new ImportFolderPipeline({
        fs: this.fs,
        network: this.network,
        logger: this.logger,
        appDataDir: this.appDataDir,
        discover: this.discover,
        reverseProxyUrl: this.reverseProxyUrl,
      });
      await pipeline.run(folderPath, type, {
        onStage: (stage, progress, detail) => {
          this.jobs.update(job.id, {
            stage,
            progress,
            ...(detail?.title !== undefined ? { recognizedTitle: detail.title } : {}),
          });
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
