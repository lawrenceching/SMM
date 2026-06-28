export type {
  CoreRoutesAuthConfig,
  CoreRoutesConfig,
  CoreRoutesLogger,
  RouteContext,
  RouteHandler,
} from "./types.ts";
export {
  enforceCoreRoutesAuth,
  isAuthTokenValid,
  isRequestAuthorized,
  parseBearerToken,
  rejectUnauthorized,
} from "./auth.ts";
export { validatePathIsInAllowlist } from "./allowlist.ts";
export { doHello, type HelloOptions } from "./hello.ts";
export { doChat, handleChatPost } from "./chat.ts";
export { createOpenAICompatible } from "@ai-sdk/openai-compatible";
export { migrateAIConfig } from "@smm/core/configMigration";
export type { AIProviderFactory, ChatConfig, ChatFs, ChatRequestBody } from "./chatTypes.ts";
export { defaultChatFs } from "./chatFs.ts";
export { createChatTools, type ChatTools, type ChatToolsExtraDeps } from "./tools/index.ts";
export {
  buildUpstreamUrl,
  DEFAULT_ALLOWED_UPSTREAM_HOSTS,
  filterRequestHeaders,
  filterResponseHeaders,
  handleProxyRequest,
  PORT_RANGE_END,
  PORT_RANGE_START,
  validateUpstreamBaseURL,
  type ReverseProxyConfig,
  type ReverseProxyLogger,
} from "./reverseProxy.ts";
export {
  createReverseProxyManager,
  createReverseProxyRequestHandler,
  findAvailableReverseProxyPort,
  type ReverseProxyManager,
  type ReverseProxyManagerConfig,
} from "./reverseProxyNode.ts";
export {
  createNodeHttpFetch,
  createStreamingNodeHttpFetch,
} from "./nodeHttpFetch.ts";
export {
  checkFolderPathAvailable,
  doIsFolderAvailable,
  resolveFolderExistence,
  type IsFolderAvailableRequestBody,
  type IsFolderAvailableResponseBody,
} from "./isFolderAvailable.ts";
export { doListFiles } from "./listFiles.ts";
export { doWriteFile, isError, ExistedFileError } from "./writeFile.ts";
export {
  checkFileIsReadable,
  doReadFile,
  type ReadFileRequestBody,
  type ReadFileResponseBody,
} from "./readFile.ts";
export {
  doDeleteFile,
  type DeleteFileRequestBody,
  type DeleteFileResponseBody,
} from "./deleteFile.ts";
export {
  doGetEpisodes,
  type GetEpisodesRequestBody,
} from "./getEpisodes.ts";
export {
  doListFilesInMediaFolder,
  type ListFilesInMediaFolderRequestBody,
} from "./listFilesInMediaFolder.ts";
export { doRenameFolder } from "./renameFolder.ts";
export { doRenameFiles } from "./renameFiles.ts";
export {
  doGetPlans,
  doGetPlanById,
  doCreatePlan,
  doUpdatePlan,
  type GetPlansResponseBody,
  type GetPlanByIdResponseBody,
  type CreatePlanResponseBody,
  type UpdatePlanResponseBody,
} from "./plansApi.ts";
export { cleanPreparingPlans } from "./tools/plans.ts";
export { cleanupStalePlans } from "./cleanup.ts";
export {
  doDownloadImage,
  type DownloadImageContentType,
  type DownloadImageResult,
} from "./downloadImage.ts";
export {
  doDownloadImageAsFile,
  type DownloadImageRequestBody,
  type DownloadImageResponseBody,
} from "./downloadImageAsFile.ts";
export {
  doReadImage,
  type ReadImageRequestBody,
  type ReadImageResponseBody,
} from "./readImage.ts";
export {
  coreRouteHandlers,
  createCoreRoutesRequestHandler,
  handleCoreRoutesRequest,
  registerCoreRoutes,
  handleListFilesGet,
  handleListFilesPost,
  handleWriteFilePost,
  handleHelloPost,
  handleIsFolderAvailablePost,
  handleGetEpisodesPost,
  handleListFilesInMediaFolderPost,
  handleRenameFolderPost,
  handleRenameFilesPost,
  handleReadFilePost,
  handleDeleteFilePost,
  handleDownloadImageGet,
  handleDownloadImageAsFilePost,
  handleReadImagePost,
  handleGetPlansPost,
  handleCreatePlanPost,
  handleUpdatePlanPost,
} from "./register.ts";
export type {
  SocketIOCorsConfig,
  SocketIOConfig,
  SocketIOManager,
  WebSocketMessage,
} from "./socketIO/types.ts";
export { createSocketIOManager } from "./socketIO/manager.ts";

// MCP (Model Context Protocol) server factory. Runtime-neutral —
// works on both Bun (`apps/cli`) and Node.js (`apps/ohos` Electron
// main process). Hosts supply runtime-specific concerns via
// `McpConfig` (`getUserConfig`, `appDataDir`, `acknowledge`, etc.).
export {
  createMcpStreamableHttpHandler,
  type McpRequestHandler,
  MCP_TOOL_NAMES,
  createErrorResponse,
  createSuccessResponse,
  type McpConfig,
  type McpToolResponse,
  type McpLifecycleManager,
  type McpServerState,
  type McpServerStatus,
  type StartMcpOptions,
  applyMcpLifecycleFromConfig,
  doMcpGetStatus,
  doMcpStart,
  doMcpStop,
  type McpLifecycleResult,
  type McpStartRequestBody,
} from "./mcp/index.ts";
export {
  handleMcpStartPut,
  handleMcpStopPut,
  handleMcpStatusGet,
} from "./routes/mcpLifecycleRoute.ts";
