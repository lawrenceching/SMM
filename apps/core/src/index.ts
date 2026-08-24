export {
  Core,
  type CoreOptions,
  type ImportFolderHandle,
  type ImportFolderOptions,
  type RenameFolderArgs,
  type ScrapeFolderHandle,
  type ScrapeFolderOptions,
  type ScrapeFolderResult,
  type SearchInTmdbOptions,
  type TmdbRequestOptions,
} from "./Core";
export type { FsPort } from "./ports/FsPort";
export type { NetworkPort, FetchInit, HttpResponse } from "./ports/NetworkPort";
export type { LoggerPort } from "./ports/LoggerPort";
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
export { ImportFolderPipeline, type ImportFolderPipelineCallbacks, type ImportFolderPipelineOptions } from "./pipeline/importFolderPipeline";
export { UserConfig, DEFAULT_USER_CONFIG, USER_CONFIG_KEYS, isUserConfigKey } from "./pipeline/userConfig";
export { recognizeMediaFolder, type RecognitionDeps, type RecognitionResult } from "./pipeline/recognizeMediaFolder";
export { recognizeEpisodes, type RecognizedEpisode } from "./pipeline/recognizeEpisodes";
export { tryToRecognizeFolderPipeline, type TryToRecognizeFolderDeps } from "./pipeline/tryToRecognizeFolder";
export { tryToRenameFolderPipeline, type TryToRenameFolderDeps } from "./pipeline/tryToRenameFolder";
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
  ScrapeJob,
  Job,
  JobStatus,
  JobStage,
  ScrapeJobTask,
  ScrapeTaskRuntimeStatus,
} from "./jobs/types";
export type { FolderType, HelloCliBody } from "@smm/core";
