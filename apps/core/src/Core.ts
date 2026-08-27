import { Path } from "@core/path";
import type {
  AppConfig,
  FolderType,
  HelloCliBody,
  MediaMetadata,
  MovieMediaMetadata,
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeriesDetails,
  TvShowMediaMetadata,
  UserConfig as UserConfigData,
} from "@smm/core";
import {
  detectOsLocale,
  parseTmdbSearchLanguage,
  resolveMediaLanguage,
  resolveTvdbSearchLanguage,
} from "@core/locale";
import { parseTvdbSearchLanguage } from "@core/tvdbSupportedLanguages";
import type { TVDBv4LanguageRecord, TVDBv4SearchResult } from "@smm/tvdb4";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import type { LoggerPort } from "./ports/LoggerPort";
import type { DiscoverPort } from "./ports/DiscoverPort";
import type { McpServerPort, McpServerState } from "./ports/McpServerPort";
import {
  CoreEventBus,
  MEDIA_METADATA_UPDATED_EVENT,
  type CoreEventMap,
  type CoreEventName,
} from "./coreEvents";
import {
  getMcpServerStatusWithConfig,
  startMcpServerWithConfig,
  stopMcpServerWithConfig,
  type McpServerOperationOptions,
  type StartMcpServerOptions,
} from "./pipeline/mcpServer";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { TmdbClient } from "./clients/TmdbClient";
import { TvdbClient } from "./clients/TvdbClient";
import { createBlankMediaMetadata, ImportFolderPipeline } from "./pipeline/importFolderPipeline";
import { dedupLibraryFolders, prepareLibraryFoldersForImport, createImportLibraryTasks, patchImportLibraryTask, importLibraryJobProgress } from "./pipeline/importLibrary";
import { renameFolderPipeline, type RenameFolderArgs } from "./pipeline/renameFolder";
import {
  renameEpisodeFilePipeline,
  type RenameEpisodeFileInput,
  type RenameEpisodeFileResult,
} from "./pipeline/renameEpisodeFile";
import { applyPlanPipeline } from "./pipeline/applyPlan";
import {
  listPlans,
  readPlan,
  rejectPlan,
  type ListPlansOptions,
  type Plan,
} from "./pipeline/plans";
import { tryToRecognizeEpisodesPipeline } from "./pipeline/tryToRecognizeEpisodes";
import {
  recognizeFolderPipeline,
  tryToRecognizeFolderPipeline,
  type RecognizeFolderCandidate,
  type RecognizeFolderDb,
} from "./pipeline/recognizeFolder";
import { tryToRenameFolderPipeline } from "./pipeline/tryToRenameFolder";
import {
  prepareScrapeFolder,
  runPreparedScrape,
  type PreparedScrape,
  type ScrapeFolderDeps,
  type ScrapeFolderOptions,
} from "./pipeline/scrape/scrapeFolder";
import type { ScrapeFolderResult } from "./pipeline/scrape/types";
import type { RenameRuleName } from "./pipeline/renameRules";
import { isUserConfigKey, UserConfigHelper } from "./pipeline/userConfigHelper";
import { MediaMetadataHelper } from "./pipeline/mediaMetadataHelper";
import type { PersistedMediaMetadata } from "./pipeline/mediaMetadataValidation";
import { JobStore } from "./jobs/jobStore";
import { initialScrapeTasks, type ImportJob, type ImportLibraryJob, type Job } from "./jobs/types";

export interface TmdbRequestOptions {
  /** TMDB language (CLI `--lang`). Validated offline against static primary_translations. */
  language?: string;
  /** Override userConfig.tmdb.host */
  host?: string;
  /** Override userConfig.tmdb.apiKey (CLI `--password`) */
  password?: string;
  /** Override userConfig.tmdb.httpProxy (CLI `--proxy`) */
  proxy?: string;
}

export interface SearchInTmdbOptions extends TmdbRequestOptions {
  type: "tv" | "movie";
}

export interface TvdbRequestOptions {
  /** TVDB language (CLI `--lang`). ISO 639-3 code, validated offline against the static list. */
  language?: string;
  /** Override userConfig.tvdb.host */
  host?: string;
  /** Override userConfig.tvdb.apiKey (CLI `--password`) */
  password?: string;
  /** Override userConfig.tvdb.httpProxy (CLI `--proxy`) */
  proxy?: string;
}

/** Raw TVDB get-by-id payload for CLI / API inspection (not MediaMetadata). */
export type TvdbByIdResult = {
  extended: unknown;
  translation: unknown | null;
};

export interface SearchInTvdbOptions extends TvdbRequestOptions {
  type: "series" | "movie";
}

export type {
  RenameFolderArgs,
  RenameEpisodeFileInput,
  RenameEpisodeFileResult,
  ScrapeFolderOptions,
  ScrapeFolderResult,
  RecognizeFolderCandidate,
  RecognizeFolderDb,
};

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
  /** Hello appDataDir; may differ from smm.json root on Linux. Falls back to appDataDir. */
  reportedAppDataDir?: string;
  /** Tmp dir for hello bootstrap. */
  tmpDir?: string;
  /** Log dir for hello bootstrap. */
  logDir?: string;
  /** CLI process platform for hello bootstrap. Falls back to process.platform. */
  platform?: string;
  /** OS locale for hello bootstrap. Falls back to detectOsLocale(). */
  osLocale?: string;
  /** Discover hosts for TMDB/TVDB failover. */
  discover?: DiscoverPort;
  /** MCP HTTP runtime (injected by CLI / OHOS host). */
  mcpServer?: McpServerPort;
}

export interface ImportFolderHandle {
  id: string;
}

export interface ImportLibraryHandle {
  id: string;
}

export interface ScrapeFolderHandle {
  id: string;
}

export interface ImportFolderOptions {
  /** When true, only register the path in UserConfig.folders; skip recognition and metadata. */
  skipInit?: boolean;
  /** When true, folder is already registered (import-library prep); run init from listFiles. */
  skipRegistration?: boolean;
}

export interface ImportLibraryOptions {
  /** When true, only register each subfolder in UserConfig.folders; skip recognition and metadata. */
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
  private readonly reportedAppDataDir: string | undefined;
  private readonly tmpDir: string | undefined;
  private readonly logDir: string | undefined;
  private readonly platform: string | undefined;
  private readonly osLocale: string | undefined;
  private readonly userConfig: UserConfigHelper;
  private readonly mediaMetadata: MediaMetadataHelper;
  private readonly discover?: DiscoverPort;
  private readonly mcpServer?: McpServerPort;
  private readonly eventBus = new CoreEventBus();

  constructor(options: CoreOptions) {
    this.fs = options.fs;
    this.network = options.network;
    this.logger = options.logger ?? new NoopLoggerAdapter();
    this.appDataDir = options.appDataDir;
    this.version = options.version ?? "";
    this.reverseProxyUrl = options.reverseProxyUrl ?? null;
    this.userDataDir = options.userDataDir ?? options.appDataDir;
    this.reportedAppDataDir = options.reportedAppDataDir;
    this.tmpDir = options.tmpDir;
    this.logDir = options.logDir;
    this.platform = options.platform;
    this.osLocale = options.osLocale;
    this.userConfig = new UserConfigHelper(this.fs, this.appDataDir);
    this.mediaMetadata = new MediaMetadataHelper(this.fs, this.appDataDir);
    this.discover = options.discover;
    this.mcpServer = options.mcpServer;
  }

  on<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.eventBus.on(event, listener);
  }

  off<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.eventBus.off(event, listener);
  }

  once<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.eventBus.once(event, listener);
  }

  private notifyMediaMetadataUpdated(folderPath: string): void {
    this.eventBus.emit(MEDIA_METADATA_UPDATED_EVENT, {
      folderPath: this.normalizePosix(folderPath),
    });
  }

  private requireMcpServer(): McpServerPort {
    if (!this.mcpServer) {
      throw new Error("MCP server port is not configured");
    }
    return this.mcpServer;
  }

  /** Starts the MCP HTTP server and, by default, persists MCP fields in smm.json. */
  async startMcpServer(
    options?: StartMcpServerOptions,
    operation?: McpServerOperationOptions,
  ): Promise<McpServerState> {
    return startMcpServerWithConfig(
      this.requireMcpServer(),
      this.userConfig,
      options,
      operation,
    );
  }

  /** Stops the MCP HTTP server and, by default, sets enableMcpServer to false. */
  async stopMcpServer(operation?: McpServerOperationOptions): Promise<McpServerState> {
    return stopMcpServerWithConfig(this.requireMcpServer(), this.userConfig, operation);
  }

  /** Returns runtime MCP state without reconciling smm.json. */
  getMcpServerState(): McpServerState {
    return this.mcpServer?.getState() ?? { status: "stopped" };
  }

  /**
   * Returns runtime MCP state. When the server is not running but
   * enableMcpServer is true, Core corrects smm.json to false.
   */
  async getMcpServerStatus(): Promise<McpServerState> {
    if (!this.mcpServer) {
      return { status: "stopped" };
    }
    return getMcpServerStatusWithConfig(this.mcpServer, this.userConfig);
  }

  /** Starts the import pipeline in the background; returns a job handle immediately. */
  importFolder(path: string, type: FolderType, options?: ImportFolderOptions): ImportFolderHandle {
    const folderPath = this.normalizePosix(path);
    const job = this.jobs.create({
      kind: "import",
      folderPath,
      type,
      status: "running",
      stage: options?.skipRegistration === true ? "listFiles" : "config",
      progress: 0,
    });
    if (options?.skipInit === true) {
      void this.runImportSkipInit(job, path);
    } else {
      void this.runImport(job, path, type, {
        skipRegistration: options?.skipRegistration === true,
      });
    }
    return { id: job.id };
  }

  /** Imports every immediate subfolder of a library directory via {@link importFolder}. */
  importLibrary(path: string, type: FolderType, options?: ImportLibraryOptions): ImportLibraryHandle {
    const libraryPath = this.normalizePosix(path);
    const job = this.jobs.create({
      kind: "import-library",
      libraryPath,
      type,
      status: "pending",
      progress: 0,
      tasks: [],
    });
    void this.runImportLibrary(job, path, type, options?.skipInit === true);
    this.logger.info(
      { jobId: job.id, libraryPath, type, skipInit: options?.skipInit === true },
      "importLibrary: job created",
    );
    return { id: job.id };
  }

  getJob(id: string): Job | undefined {
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

  /** Bootstrap info for CLI and HTTP adapters; never touches fs. */
  hello(): HelloCliBody {
    return {
      uptime: process.uptime(),
      version: this.version,
      platform: this.platform ?? process.platform,
      userDataDir: this.userDataDir,
      appDataDir: this.reportedAppDataDir ?? this.appDataDir,
      tmpDir: this.tmpDir ?? "",
      logDir: this.logDir ?? "",
      osLocale: this.osLocale ?? detectOsLocale(),
    };
  }

  getUserConfig(): Promise<UserConfigData> {
    return this.userConfig.read();
  }

  /** Updates one known UserConfig key. Rejects unknown keys and invalid values without writing. */
  async setUserConfigKey(key: string, value: unknown): Promise<UserConfigData> {
    if (!isUserConfigKey(key)) {
      throw new Error(`Unknown config key: ${key}`);
    }
    return this.userConfig.setKey(key, value);
  }

  async getFolders(): Promise<string[]> {
    return this.userConfig.getFolders();
  }

  /** Reads the persisted metadata cache for a folder; null when absent or corrupt. */
  async getMediaMetadata(folder: string): Promise<PersistedMediaMetadata | null> {
    return this.mediaMetadata.read(this.normalizePosix(folder));
  }

  /** Writes the metadata cache for `mm.mediaFolderPath`. Strips deprecated `files`. Full replace. */
  async setMetadata(mm: MediaMetadata): Promise<void> {
    const { files: _files, ...rest } = mm;
    await this.mediaMetadata.write(rest);
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
      await this.mediaMetadata.delete(posixPath);
    }
  }

  async renameFolder(args: RenameFolderArgs): Promise<void> {
    await renameFolderPipeline(args, {
      fs: this.fs,
      userConfig: this.userConfig,
      mediaMetadata: this.mediaMetadata,
      normalizePosix: (path) => this.normalizePosix(path),
    });
  }

  /** Rename a linked TV episode file and same-stem associates; updates metadata. */
  async renameEpisodeFile(input: RenameEpisodeFileInput): Promise<RenameEpisodeFileResult> {
    return renameEpisodeFilePipeline(input, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (path) => this.normalizePosix(path),
      getMediaMetadata: (folder) => this.getMediaMetadata(folder),
      setMetadata: (mm) => this.setMetadata(mm),
    });
  }

  async tryToRecognizeEpisodes(path: string): Promise<RecognizeMediaFilePlan> {
    return tryToRecognizeEpisodesPipeline(path, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
    });
  }

  async tryToRecognizeFolder(path: string): Promise<RecognizeFolderCandidate> {
    const config = await this.userConfig.read();
    const language = config.preferMediaLanguage ?? "en-US";
    const { client: tmdb } = await this.createTmdbClient({});
    const { client: tvdb } = await this.createTvdbClient({}, false);
    return tryToRecognizeFolderPipeline(path, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      mediaMetadata: this.mediaMetadata,
      normalizePosix: (p) => this.normalizePosix(p),
      tmdb,
      tvdb,
      language,
      primaryDatabase: config.primaryDatabase,
    });
  }

  async recognizeFolder(
    path: string,
    options: { db: RecognizeFolderDb; id: string },
  ): Promise<void> {
    const config = await this.userConfig.read();
    const language = config.preferMediaLanguage ?? "en-US";
    const { client: tmdb } = await this.createTmdbClient({});
    const { client: tvdb } = await this.createTvdbClient({}, false);
    await recognizeFolderPipeline(path, options, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      mediaMetadata: this.mediaMetadata,
      normalizePosix: (p) => this.normalizePosix(p),
      tmdb,
      tvdb,
      language,
      primaryDatabase: config.primaryDatabase,
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

  async listPlans(options?: ListPlansOptions): Promise<Plan[]> {
    return listPlans(this.fs, this.appDataDir, options);
  }

  async rejectPlan(id: string): Promise<Plan> {
    return rejectPlan(this.fs, this.appDataDir, id);
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

  async scrapeFolder(path: string, options?: ScrapeFolderOptions): Promise<ScrapeFolderHandle> {
    const scrapeDeps = this.createScrapeDeps();
    const prepared = await prepareScrapeFolder(path, options, scrapeDeps);
    const job = this.jobs.create({
      kind: "scrape",
      folderPath: prepared.posixPath,
      status: "running",
      tasks: initialScrapeTasks(),
    });
    void this.runScrape(job.id, prepared, scrapeDeps);
    return { id: job.id };
  }

  /**
   * Search TMDB via {@link NetworkPort} (CLI uses NodejsNetworkPort).
   * Uses direct host+proxy (no reverse proxy) so outbound `proxy` applies on NetworkPort.
   * Explicit `language` is validated offline against the static TMDB primary_translations snapshot.
   */
  async searchInTmdb(keyword: string, options: SearchInTmdbOptions): Promise<TmdbSearchResponseBody> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      throw new Error("keyword is required");
    }

    const { client, language } = await this.createTmdbClient(options);
    return client.search(trimmed, options.type, language);
  }

  /** Fetch TMDB movie details by id via {@link NetworkPort}. */
  async getMovieInTmdb(id: number, options: TmdbRequestOptions = {}): Promise<TmdbMovieDetails> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTmdbClient(options);
    return client.getMovieById(id, language);
  }

  /** Fetch TMDB TV series details by id via {@link NetworkPort}. */
  async getTvShowInTmdb(id: number, options: TmdbRequestOptions = {}): Promise<TmdbSeriesDetails> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTmdbClient(options);
    return client.getTvShowById(id, language);
  }

  /**
   * Search TVDB via {@link NetworkPort} (CLI uses NodejsNetworkPort).
   * Explicit `language` is ISO 639-3, validated offline against the static
   * supported-languages snapshot. When omitted it resolves preferMediaLanguage → OS → eng.
   */
  async searchInTvdb(keyword: string, options: SearchInTvdbOptions): Promise<TVDBv4SearchResult[]> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      throw new Error("keyword is required");
    }
    const { client, language } = await this.createTvdbClient(options);
    const results = options.type === "series"
      ? await client.searchSeries(trimmed, language)
      : await client.searchMovie(trimmed, language);
    if (!results) {
      throw new Error("TVDB search failed");
    }
    return results;
  }

  /** Fetch TVDB series metadata (seasons + episodes + translations) by id via {@link NetworkPort}. */
  async getTvShowInTvdb(id: number, options: TvdbRequestOptions = {}): Promise<TvShowMediaMetadata> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTvdbClient(options);
    const metadata = await client.getTvShowMediaMetadata(id, language);
    if (!metadata) {
      throw new Error(`Failed to get TVDB series ${id}`);
    }
    return metadata;
  }

  /** Fetch TVDB movie metadata by id via {@link NetworkPort}. */
  async getMovieInTvdb(id: number, options: TvdbRequestOptions = {}): Promise<MovieMediaMetadata> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTvdbClient(options);
    const metadata = await client.getMovieMediaMetadata(id, language);
    if (!metadata) {
      throw new Error(`Failed to get TVDB movie ${id}`);
    }
    return metadata;
  }

  /**
   * Fetch raw TVDB series extended + translation payloads (not MediaMetadata).
   * `language` is ISO 639-3 (CLI `--lang`); translation may be null if unavailable.
   */
  async getTvdbSeriesById(id: number, options: TvdbRequestOptions = {}): Promise<TvdbByIdResult> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTvdbClient(options);
    const extended = await client.getSeriesExtended(id);
    if (!extended) {
      throw new Error(`Failed to get TVDB series ${id}`);
    }
    const translation = (await client.getSeriesTranslation(id, language)) ?? null;
    return { extended, translation };
  }

  /**
   * Fetch raw TVDB movie extended + translation payloads (not MediaMetadata).
   * `language` is ISO 639-3 (CLI `--lang`); translation may be null if unavailable.
   */
  async getTvdbMovieById(id: number, options: TvdbRequestOptions = {}): Promise<TvdbByIdResult> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("id must be a positive integer");
    }
    const { client, language } = await this.createTvdbClient(options);
    const extended = await client.getMovieExtended(id);
    if (!extended) {
      throw new Error(`Failed to get TVDB movie ${id}`);
    }
    const translation = (await client.getMovieTranslation(id, language)) ?? null;
    return { extended, translation };
  }

  /** Fetch the TVDB supported language list via {@link NetworkPort}. */
  async getTvdbLanguages(options: TvdbRequestOptions = {}): Promise<TVDBv4LanguageRecord[]> {
    const { client } = await this.createTvdbClient(options, false);
    const languages = await client.getLanguages();
    if (!languages) {
      throw new Error("Failed to get TVDB languages");
    }
    return languages;
  }

  private async createTmdbClient(
    options: TmdbRequestOptions,
  ): Promise<{ client: TmdbClient; language: string }> {
    const config = await this.userConfig.read();
    const language = options.language?.trim()
      ? parseTmdbSearchLanguage(options.language)
      : resolveMediaLanguage({
          preferMediaLanguage: config.preferMediaLanguage,
          configured: config.applicationLanguage,
          osLocale: detectOsLocale(),
        });
    const host = options.host?.trim() || config.tmdb?.host;
    const apiKey = options.password?.trim() || config.tmdb?.apiKey;
    const httpProxy = options.proxy?.trim() || config.tmdb?.httpProxy;

    const client = new TmdbClient(this.network, {
      host,
      apiKey,
      httpProxy,
      reverseProxyUrl: null,
      discover: this.discover,
    });

    return { client, language };
  }

  private async createTvdbClient(
    options: TvdbRequestOptions,
    resolveLanguage = true,
  ): Promise<{ client: TvdbClient; language: string }> {
    const config = await this.userConfig.read();
    const language = resolveLanguage
      ? (options.language?.trim()
          ? parseTvdbSearchLanguage(options.language)
          : resolveTvdbSearchLanguage({
              preferMediaLanguage: config.preferMediaLanguage,
              configured: config.applicationLanguage,
              osLocale: detectOsLocale(),
            }))
      : "";
    const host = options.host?.trim() || config.tvdb?.host;
    const apiKey = options.password?.trim() || config.tvdb?.apiKey;
    const httpProxy = options.proxy?.trim() || config.tvdb?.httpProxy;

    const client = new TvdbClient(this.network, {
      host,
      apiKey,
      httpProxy,
      reverseProxyUrl: null,
      discover: this.discover,
    });

    return { client, language };
  }

  private normalizePosix(path: string): string {
    try {
      return Path.posix(path);
    } catch {
      return path;
    }
  }

  private createScrapeDeps(): ScrapeFolderDeps {
    return {
      fs: this.fs,
      network: this.network,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (p: string) => this.normalizePosix(p),
      discover: this.discover,
      reverseProxyUrl: this.reverseProxyUrl,
    };
  }

  private async runScrape(
    jobId: string,
    prepared: PreparedScrape,
    deps: ScrapeFolderDeps,
  ): Promise<void> {
    try {
      await runPreparedScrape(prepared, deps, {
        onTaskStart: (taskId) => {
          const current = this.jobs.get(jobId);
          if (current?.kind !== "scrape") return;
          this.jobs.update(jobId, {
            tasks: { ...current.tasks, [taskId]: { status: "running" } },
          });
        },
        onTaskDone: (taskId, result) => {
          const current = this.jobs.get(jobId);
          if (current?.kind !== "scrape") return;
          this.jobs.update(jobId, {
            tasks: {
              ...current.tasks,
              [taskId]: {
                status: result.status,
                ...(result.error !== undefined ? { error: result.error } : {}),
              },
            },
          });
        },
      });
      const finalJob = this.jobs.get(jobId);
      if (finalJob?.kind !== "scrape") return;
      const anyFailed = Object.values(finalJob.tasks).some((t) => t.status === "failed");
      this.jobs.update(jobId, { status: anyFailed ? "failed" : "succeeded" });
    } catch (error) {
      this.jobs.update(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runImportSkipInit(job: ImportJob, folderPath: string): Promise<void> {
    try {
      await this.userConfig.addFolder(folderPath);
      const blankMetadata = createBlankMediaMetadata(folderPath, job.type);
      await this.setMetadata(blankMetadata);
      this.jobs.update(job.id, { status: "succeeded", stage: "metadata", progress: 100 });
    } catch (error) {
      this.jobs.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runImport(
    job: ImportJob,
    folderPath: string,
    type: FolderType,
    options?: { skipRegistration?: boolean },
  ): Promise<void> {
    try {
      const pipeline = new ImportFolderPipeline({
        fs: this.fs,
        network: this.network,
        logger: this.logger,
        appDataDir: this.appDataDir,
        discover: this.discover,
        reverseProxyUrl: this.reverseProxyUrl,
      });
      await pipeline.run(
        folderPath,
        type,
        {
          onStage: (stage, progress, detail) => {
            this.jobs.update(job.id, {
              stage,
              progress,
              ...(detail?.title !== undefined ? { recognizedTitle: detail.title } : {}),
            });
          },
        },
        { skipRegistration: options?.skipRegistration === true },
      );
      this.jobs.update(job.id, { status: "succeeded", stage: null, progress: 100 });
      this.notifyMediaMetadataUpdated(folderPath);
    } catch (error) {
      this.jobs.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runImportLibrary(
    job: ImportLibraryJob,
    libraryPath: string,
    type: FolderType,
    skipInit: boolean,
  ): Promise<void> {
    try {
      if (!(await this.fs.exists(libraryPath))) {
        throw new Error(`Library path not found: ${libraryPath}`);
      }
      const subdirs = await this.fs.listSubdirectories(libraryPath);
      const existing = await this.getFolders();
      const toImport = dedupLibraryFolders(subdirs, existing);
      const tasks = createImportLibraryTasks(job.id, toImport);
      this.jobs.update(job.id, { tasks });
      this.logger.info(
        { jobId: job.id, libraryPath, folderCount: toImport.length, folderPaths: toImport },
        "importLibrary: folders discovered",
      );

      await prepareLibraryFoldersForImport(toImport, type, {
        writeBlankMetadata: (metadata) => this.mediaMetadata.write(metadata),
        upsertFolders: async (folders) => {
          await this.userConfig.update((config) => ({
            ...config,
            folders: [...new Set([...config.folders, ...folders])],
          }));
        },
      });
      this.logger.info(
        { jobId: job.id, folderCount: toImport.length },
        "importLibrary: folder registration complete (metadata + UserConfig)",
      );

      if (skipInit) {
        const succeededTasks = tasks.map((task) => ({
          ...task,
          status: "succeeded" as const,
          importJobId: undefined,
        }));
        this.jobs.update(job.id, {
          status: "succeeded",
          progress: 100,
          tasks: succeededTasks,
        });
        return;
      }

      this.jobs.update(job.id, { status: "running" });
      let currentTasks = tasks;

      for (const task of tasks) {
        currentTasks = patchImportLibraryTask(currentTasks, task.id, {
          status: "running",
        });
        this.jobs.update(job.id, {
          tasks: currentTasks,
          progress: importLibraryJobProgress(currentTasks),
        });

        const { id: childId } = this.importFolder(task.path, type, { skipRegistration: true });
        currentTasks = patchImportLibraryTask(currentTasks, task.id, { importJobId: childId });
        this.jobs.update(job.id, { tasks: currentTasks });

        await this.waitForImportJob(childId);
        const childJob = this.jobs.get(childId);
        if (childJob?.kind === "import" && childJob.status === "failed") {
          currentTasks = patchImportLibraryTask(currentTasks, task.id, {
            status: "failed",
            importJobId: undefined,
          });
          this.jobs.update(job.id, { tasks: currentTasks });
          throw new Error(childJob.error ?? `Failed to import folder: ${task.path}`);
        }

        currentTasks = patchImportLibraryTask(currentTasks, task.id, {
          status: "succeeded",
          importJobId: undefined,
        });
        this.jobs.update(job.id, {
          tasks: currentTasks,
          progress: importLibraryJobProgress(currentTasks),
        });
      }

      this.jobs.update(job.id, {
        status: "succeeded",
        progress: 100,
        tasks: currentTasks,
      });
      this.logger.info({ jobId: job.id, taskCount: tasks.length }, "importLibrary: job succeeded");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ jobId: job.id, libraryPath, error: message }, "importLibrary: job failed");
      this.jobs.update(job.id, {
        status: "failed",
        error: message,
      });
    }
  }

  private async waitForImportJob(id: string): Promise<void> {
    for (;;) {
      const job = this.jobs.get(id);
      if (job?.kind === "import" && job.status !== "pending" && job.status !== "running") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}
