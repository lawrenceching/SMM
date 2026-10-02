import { Path } from "@smm/utils/path";
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
} from "@smm/types";
import {
  detectOsLocale,
  parseTmdbSearchLanguage,
  resolveMediaLanguage,
  resolveTvdbSearchLanguage,
} from "@smm/utils/locale";
import { parseTvdbSearchLanguage } from "@smm/types/tvdbSupportedLanguages";
import type { TVDBv4LanguageRecord, TVDBv4SearchResult } from "@smm/tvdb4";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
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
import {
  HostPerformanceStore,
  mergeHostUrls,
  type HostPerformanceEntry,
  type HostPerformanceKind,
} from "./clients/hostPerformance";
import { speedTestHosts } from "./clients/hostSpeedTest";
import { STATIC_MEDIA_DATABASES } from "./adapters/StaticDiscoverAdapter";
import { ImportFolderJob } from "./jobs/ImportFolderJob";
import { ImportLibraryJob } from "./jobs/ImportLibraryJob";
import { ScrapeJob } from "./jobs/ScrapeJob";
import { nextJobId } from "./jobs/jobManager";
import { createRecognitionDeps } from "./pipeline/createRecognitionDeps";
import { renameFolderPipeline, type RenameFolderArgs } from "./pipeline/renameFolder";
import {
  renameEpisodeFilePipeline,
  type RenameEpisodeFileInput,
  type RenameEpisodeFileResult,
} from "./pipeline/renameEpisodeFile";
import { applyPlanPipeline, type ApplyPlanData } from "./pipeline/applyPlan";
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
  type RecognizeFolderDeps,
} from "./pipeline/recognizeFolder";
import {
  createRenameEpisodePlanPipeline,
  type CreateRenameEpisodePlanOptions,
} from "./pipeline/createRenameEpisodePlan";
import {
  createRecognizeEpisodePlanPipeline,
  type CreateRecognizeEpisodePlanOptions as CreateRecognizeEpisodePlanCoreOptions,
} from "./pipeline/createRecognizeEpisodePlan";
import { tryToRenameFolderPipeline } from "./pipeline/tryToRenameFolder";
import {
  prepareScrapeFolder,
  type ScrapeFolderOptions,
} from "./pipeline/scrape/scrapeFolder";
import type { ScrapeFolderResult } from "./pipeline/scrape/types";
import type { RenameRuleName } from "./pipeline/renameRules";
import { isUserConfigKey, UserConfigHelper } from "./pipeline/userConfigHelper";
import { MediaMetadataHelper } from "./pipeline/mediaMetadataHelper";
import type { PersistedMediaMetadata } from "./pipeline/mediaMetadataValidation";
import { MetadataAlreadyExistsError, MetadataNotFoundError } from "./pipeline/metadataErrors";
import { applyMetadataPatch, type MetadataPatch } from "./pipeline/setMetadataPatch";
import { JobManager } from "./jobs/jobManager";
import type { AbstractJob, Callbacks } from "./jobs/abstract-job";
import type { AppContext, AppContextInput, PlatformPorts, PlatformPortsInput } from "./types";

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
  context: AppContextInput;
  ports: PlatformPortsInput;
  /** When true, run host speed tests in the background after construction. */
  enableHostSpeedTest?: boolean;
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
  /** When true, stop after stage 1: the folder is registered but never recognized. */
  skipInit?: boolean;
}

export interface ImportLibraryOptions {
  /** When true, only register each subfolder in UserConfig.folders; skip recognition and metadata. */
  skipInit?: boolean;
}

export class Core {
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
  private readonly hostPerformance = new HostPerformanceStore();

  constructor(options: CoreOptions) {
    const { context, ports } = options;
    this.fs = ports.fs;
    this.network = ports.network;
    this.logger = ports.logger ?? new NoopLoggerAdapter();
    this.appDataDir = context.appDataDir;
    this.version = context.version ?? "";
    this.reverseProxyUrl = context.reverseProxyUrl ?? null;
    this.userDataDir = context.userDataDir ?? context.appDataDir;
    this.reportedAppDataDir = context.reportedAppDataDir;
    this.tmpDir = context.tmpDir;
    this.logDir = context.logDir;
    this.platform = context.platform;
    this.osLocale = context.osLocale;
    this.userConfig = new UserConfigHelper(this.fs, this.userDataDir);
    this.mediaMetadata = new MediaMetadataHelper(this.fs, this.getMetadataRoot(), (folderPath) => {
      this.eventBus.emit(MEDIA_METADATA_UPDATED_EVENT, { folderPath });
    });
    this.discover = ports.discover;
    this.mcpServer = options.mcpServer;
    if (options.enableHostSpeedTest === true) {
      void this.runHostSpeedTests();
    }
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

  /**
   * Measure TMDB/TVDB (and asset CDN) hosts after app start-up.
   * CLI one-shot commands skip this so the performance list stays empty.
   */
  async runHostSpeedTests(): Promise<void> {
    const remote = this.discover
      ? await this.discover.getDiscoverConfig().catch(() => ({ mediaDatabases: [], reverseProxies: [] }))
      : { mediaDatabases: [], reverseProxies: [] };
    const kinds: HostPerformanceKind[] = ["tmdb", "tvdb", "tmdb-asset", "tvdb-asset"];
    for (const kind of kinds) {
      const staticUrls = STATIC_MEDIA_DATABASES.filter((entry) => entry.type === kind).map((entry) => entry.url);
      const remoteUrls = remote.mediaDatabases.filter((entry) => entry.type === kind).map((entry) => entry.url);
      const hosts = mergeHostUrls(staticUrls, remoteUrls);
      const results = await speedTestHosts(this.network, hosts);
      this.hostPerformance.set(kind, results);
    }
  }

  getHostPerformanceList(kind: HostPerformanceKind): readonly HostPerformanceEntry[] {
    return this.hostPerformance.get(kind);
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

  private _jobManager: JobManager | undefined;
  private get jobManager(): JobManager {
    if(this._jobManager === undefined) {
      this._jobManager = new JobManager(
        // TODO: add app config
        { concurrency: 1, timeoutMs: 5 * 60 * 1000 }, 
        {
          fs: this.fs,
          network: this.network,
          logger: this.logger,
          normalizePosix: (p) => this.normalizePosix(p),
          discover: this.discover,
          hostPerformance: this.hostPerformance,
        }
      )
    }
    return this._jobManager;
  }

  async waitForJobUntilCompleted(id: string): Promise<void> {
    return this.jobManager.waitForJobUntilCompleted(id);
  }

  /**
   * Runs stage 1 of folder initialization (smm.json + blank metadata file) and returns
   * once it completed; stages 2 and 3 continue in the background. Stage 1 failures are
   * reported on the job, never thrown. See docs/dev/import-folder.md.
   */
  async importFolder(options: {    
    path: string,
    type: FolderType,
    skipInit: boolean,
    callbacks: Callbacks
  }): Promise<ImportFolderHandle> {

    const ctx: AppContext = {
      appDataDir: this.getMetadataRoot(),
      userDataDir: this.userDataDir,
      osLocale: this.osLocale ?? "",
      tmpDir: this.tmpDir ?? "",
      logDir: this.logDir ?? "",
    };
    const ports: PlatformPorts = {
      fs: this.fs,
      network: this.network,
      logger: this.logger,
      normalizePosix: (p) => this.normalizePosix(p),
      discover: this.discover,
      hostPerformance: this.hostPerformance,
    };
    const job = new ImportFolderJob(ctx, ports, {
      id: Date.now().toString(),
      logDir: ctx.logDir,
      join: (...parts) => this.fs.join(...parts),
      printLogToConsole: false,
      folderPath: options.path,
      skipInit: options.skipInit,
      type: options.type,
      onMediaMetadataUpdated: (folderPath) => {
        this.eventBus.emit(MEDIA_METADATA_UPDATED_EVENT, { folderPath });
      },
      callbacks: options.callbacks,
    });

    this.jobManager.submit(job, () => {});
    return { id: job.id };
  }

  /** Imports every immediate subfolder of a library directory via {@link ImportLibraryJob}. */
  async importLibrary(options: {
    path: string;
    type: FolderType;
    skipInit: boolean;
    concurrency?: number;
    callbacks: Callbacks;
  }): Promise<ImportLibraryHandle> {
    const ctx: AppContext = {
      appDataDir: this.getMetadataRoot(),
      userDataDir: this.userDataDir,
      osLocale: this.osLocale ?? "",
      tmpDir: this.tmpDir ?? "",
      logDir: this.logDir ?? "",
    };
    const ports: PlatformPorts = {
      fs: this.fs,
      network: this.network,
      logger: this.logger,
      normalizePosix: (p) => this.normalizePosix(p),
      discover: this.discover,
      hostPerformance: this.hostPerformance,
    };
    const job = new ImportLibraryJob(ctx, ports, {
      id: Date.now().toString(),
      logDir: ctx.logDir,
      join: (...parts) => this.fs.join(...parts),
      printLogToConsole: false,
      libraryPath: options.path,
      type: options.type,
      skipInit: options.skipInit,
      concurrency: options.concurrency ?? 1,
      onMediaMetadataUpdated: (folderPath) => {
        this.eventBus.emit(MEDIA_METADATA_UPDATED_EVENT, { folderPath });
      },
      callbacks: options.callbacks,
    });

    this.jobManager.submit(job, () => {});
    return { id: job.id };
  }

  getJob(id: string): AbstractJob | undefined {
    return this.jobManager.getJob(id);
  }

  async getJobLog(id: string): Promise<string> {
    const job = this.getJob(id);
    if(job === undefined) {
      throw new Error("Job not found");
    }
    return await this.fs.readTextFile(job.logFilePath);
  }

  stopJob(id: string): void {
    this.jobManager.tryAbort(id);
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

  /** Reads persisted metadata or throws when the cache is absent or corrupt. */
  async getMetadata(folderPath: string): Promise<PersistedMediaMetadata> {
    const normalizedPath = this.normalizePosix(folderPath);
    const metadata = await this.mediaMetadata.read(normalizedPath);
    if (!metadata) throw new MetadataNotFoundError(normalizedPath);
    return metadata;
  }

  /** Creates persisted metadata and rejects an existing cache. */
  async createMetadata(mm: MediaMetadata): Promise<PersistedMediaMetadata> {
    const folderPath = this.normalizePosix(mm.mediaFolderPath ?? "");
    const created = await this.mediaMetadata.createIfAbsent(mm);
    if (!created) {
      throw new MetadataAlreadyExistsError(folderPath);
    }
    return created;
  }

  /** Applies an allow-listed partial update to existing metadata. */
  async setMetadata(
    folderPath: string,
    patch: MetadataPatch,
  ): Promise<PersistedMediaMetadata> {
    const normalizedPath = this.normalizePosix(folderPath);
    const updated = await this.mediaMetadata.updateIfPresent(normalizedPath, (current) =>
      applyMetadataPatch(current, patch),
    );
    if (!updated) throw new MetadataNotFoundError(normalizedPath);
    return updated;
  }

  /** Deletes persisted metadata. Idempotent. */
  async deleteMetadata(folderPath: string): Promise<void> {
    await this.mediaMetadata.delete(this.normalizePosix(folderPath));
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
      appDataDir: this.getMetadataRoot(),
      userConfig: this.userConfig,
      normalizePosix: (path) => this.normalizePosix(path),
      getMediaMetadata: (folder) => this.readMetadata(folder),
      setMetadata: (mm) => this.writeMetadata(mm),
    });
  }

  async tryToRecognizeEpisodes(path: string): Promise<RecognizeMediaFilePlan> {
    return tryToRecognizeEpisodesPipeline(path, {
      fs: this.fs,
      appDataDir: this.getMetadataRoot(),
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
    });
  }

  /** Shared by user-triggered recognition and by folder initialization stages 2 and 3. */
  private async createRecognitionDeps(): Promise<RecognizeFolderDeps> {
    return createRecognitionDeps({
      fs: this.fs,
      network: this.network,
      appDataDir: this.getMetadataRoot(),
      userDataDir: this.userDataDir,
      normalizePosix: (p) => this.normalizePosix(p),
      osLocale: this.osLocale,
      discover: this.discover,
      hostPerformance: this.hostPerformance,
      onMediaMetadataUpdated: (folderPath) => {
        this.eventBus.emit(MEDIA_METADATA_UPDATED_EVENT, { folderPath });
      },
    });
  }

  async tryToRecognizeFolder(path: string): Promise<RecognizeFolderCandidate> {
    return tryToRecognizeFolderPipeline(path, await this.createRecognitionDeps());
  }

  async recognizeFolder(
    path: string,
    options: { db: RecognizeFolderDb; id: string },
  ): Promise<void> {
    await recognizeFolderPipeline(path, options, await this.createRecognitionDeps());
  }

  async tryToRenameFolder(path: string, rule?: RenameRuleName): Promise<RenameFilesPlan> {
    return tryToRenameFolderPipeline(path, rule, {
      fs: this.fs,
      appDataDir: this.getMetadataRoot(),
      userConfig: this.userConfig,
      normalizePosix: (p) => this.normalizePosix(p),
    });
  }

  async createRenameEpisodePlan(
    mediaFolderPath: string,
    files: Array<{ from: string; to: string }>,
    options?: CreateRenameEpisodePlanOptions,
  ): Promise<RenameFilesPlan> {
    return createRenameEpisodePlanPipeline(mediaFolderPath, files, options, {
      fs: this.fs,
      appDataDir: this.getMetadataRoot(),
      normalizePosix: (path) => this.normalizePosix(path),
      getMediaMetadata: (folder) => this.readMetadata(folder),
    });
  }

  async createRecognizeEpisodePlan(
    mediaFolderPath: string,
    files: Array<{ season: number; episode: number; path: string }>,
    options?: CreateRecognizeEpisodePlanCoreOptions,
  ): Promise<RecognizeMediaFilePlan> {
    return createRecognizeEpisodePlanPipeline(mediaFolderPath, files, options, {
      fs: this.fs,
      appDataDir: this.getMetadataRoot(),
      normalizePosix: (path) => this.normalizePosix(path),
    });
  }

  async getPlan(id: string): Promise<Plan> {
    const plan = await readPlan(this.fs, this.getMetadataRoot(), id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    return plan;
  }

  async listPlans(options?: ListPlansOptions): Promise<Plan[]> {
    return listPlans(this.fs, this.getMetadataRoot(), options);
  }

  async rejectPlan(id: string): Promise<Plan> {
    return rejectPlan(this.fs, this.getMetadataRoot(), id);
  }

  async applyPlan(plan: Plan, data?: ApplyPlanData): Promise<void> {
    await applyPlanPipeline(
      plan,
      {
        fs: this.fs,
        appDataDir: this.getMetadataRoot(),
        normalizePosix: (p) => this.normalizePosix(p),
        setMetadata: (mm) => this.writeMetadata(mm),
        getMediaMetadata: (folder) => this.readMetadata(folder),
      },
      data,
    );
  }

  /**
   * Validates the folder, then runs poster / fanart / thumbnail / NFO scrape in the background.
   * Validation failures are thrown before a job is created.
   */
  async scrapeFolder(options: {
    path: string;
    language?: string;
    callbacks: Callbacks;
  }): Promise<ScrapeFolderHandle> {
    const ctx: AppContext = {
      appDataDir: this.getMetadataRoot(),
      userDataDir: this.userDataDir,
      osLocale: this.osLocale ?? "",
      tmpDir: this.tmpDir ?? "",
      logDir: this.logDir ?? "",
      reverseProxyUrl: this.reverseProxyUrl,
    };
    const ports: PlatformPorts = {
      fs: this.fs,
      network: this.network,
      logger: this.logger,
      normalizePosix: (p) => this.normalizePosix(p),
      discover: this.discover,
      hostPerformance: this.hostPerformance,
    };
    const prepared = await prepareScrapeFolder(
      options.path,
      options.language !== undefined ? { language: options.language } : undefined,
      ctx,
      ports,
    );
    const job = new ScrapeJob(ctx, ports, {
      id: nextJobId(),
      logDir: ctx.logDir,
      join: (...parts) => this.fs.join(...parts),
      printLogToConsole: false,
      folderPath: prepared.posixPath,
      prepared,
      callbacks: options.callbacks,
    });
    this.jobManager.submit(job, () => {});
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
      hostPerformance: this.hostPerformance,
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
      hostPerformance: this.hostPerformance,
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

  private getMetadataRoot(): string {
    return this.reportedAppDataDir ?? this.appDataDir;
  }

  private readMetadata(folderPath: string): Promise<PersistedMediaMetadata | null> {
    return this.mediaMetadata.read(this.normalizePosix(folderPath));
  }

  private async writeMetadata(mm: MediaMetadata): Promise<void> {
    await this.mediaMetadata.write(mm);
  }

}
