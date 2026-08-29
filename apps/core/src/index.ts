export {
  Core,
  type CoreOptions,
  type ImportFolderHandle,
  type ImportFolderOptions,
  type ImportLibraryHandle,
  type ImportLibraryOptions,
  type RenameFolderArgs,
  type ScrapeFolderHandle,
  type ScrapeFolderOptions,
  type ScrapeFolderResult,
  type SearchInTmdbOptions,
  type TmdbRequestOptions,
  type TvdbByIdResult,
  type TvdbRequestOptions,
  type RecognizeFolderCandidate,
  type RecognizeFolderDb,
} from "./Core";
export type { FsPort } from "./ports/FsPort";
export type { NetworkPort, FetchInit, HttpResponse } from "./ports/NetworkPort";
export type { LoggerPort } from "./ports/LoggerPort";
export {
  CoreEventBus,
  MEDIA_METADATA_UPDATED_EVENT,
  type CoreEventMap,
  type CoreEventName,
} from "./coreEvents";
export type {
  DiscoverPort,
  DiscoverConfig,
  MediaDatabaseEntry,
  ReverseProxyEntry,
} from "./ports/DiscoverPort";
export type {
  McpServerPort,
  McpServerState,
  McpServerStartOptions,
  McpServerStatus,
} from "./ports/McpServerPort";
export {
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  getMcpServerStatusWithConfig,
  resolveMcpStartOptions,
  startMcpServerWithConfig,
  stopMcpServerWithConfig,
  type McpServerOperationOptions,
  type StartMcpServerOptions,
} from "./pipeline/mcpServer";
export { NodejsFsAdapter } from "./adapters/node/NodejsFsAdapter";
export { NetworkFsAdapter, type NetworkFsAdapterOptions } from "./adapters/network/NetworkFsAdapter";
export { FetchNetworkAdapter } from "./adapters/FetchNetworkAdapter";
export { ConsoleLoggerAdapter, NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
export { StaticDiscoverAdapter, STATIC_MEDIA_DATABASES } from "./adapters/StaticDiscoverAdapter";
export {
  HostPerformanceStore,
  type HostPerformanceEntry,
  type HostPerformanceKind,
} from "./clients/hostPerformance";
export { ImportFolderPipeline, type ImportFolderPipelineCallbacks, type ImportFolderPipelineOptions } from "./pipeline/importFolderPipeline";
export {
  UserConfigHelper,
  DEFAULT_USER_CONFIG,
  USER_CONFIG_KEYS,
  isUserConfigKey,
} from "./pipeline/userConfigHelper";
export { validateUserConfig, validateUserConfigValue } from "./pipeline/userConfigValidation";
export {
  MediaMetadataHelper,
} from "./pipeline/mediaMetadataHelper";
export {
  validatePersistedMediaMetadata,
  stripDeprecatedFiles,
  type PersistedMediaMetadata,
} from "./pipeline/mediaMetadataValidation";
export { recognizeMediaFolder, type RecognitionDeps, type RecognitionResult } from "./pipeline/recognizeMediaFolder";
export { recognizeEpisodes, type RecognizedEpisode } from "./pipeline/recognizeEpisodes";
export { tryToRecognizeEpisodesPipeline, type TryToRecognizeEpisodesDeps } from "./pipeline/tryToRecognizeEpisodes";
export {
  tryToRecognizeFolderPipeline,
  recognizeFolderPipeline,
  type RecognizeFolderDeps,
} from "./pipeline/recognizeFolder";
export { tryToRenameFolderPipeline, type TryToRenameFolderDeps } from "./pipeline/tryToRenameFolder";
export {
  createRenameEpisodePlanPipeline,
  type CreateRenameEpisodePlanDeps,
  type CreateRenameEpisodePlanOptions,
} from "./pipeline/createRenameEpisodePlan";
export type { RenameRuleName } from "./pipeline/renameRules";
export type { Plan } from "./pipeline/plans";
export {
  scrapeFolderPipeline,
  type ScrapeFolderDeps,
} from "./pipeline/scrape/scrapeFolder";
export type {
  ScrapeTaskId,
  ScrapeTaskStatus,
  ScrapeTaskResult,
} from "./pipeline/scrape/types";
export { parseNfo, type ParsedNfo } from "./pipeline/nfo";
export type {
  ImportJob,
  ImportLibraryJob,
  ImportLibraryJobTask,
  ScrapeJob,
  Job,
  JobStatus,
  JobStage,
  ScrapeJobTask,
  ScrapeTaskRuntimeStatus,
} from "./jobs/types";
export type { FolderType, HelloCliBody } from "@smm/core";
