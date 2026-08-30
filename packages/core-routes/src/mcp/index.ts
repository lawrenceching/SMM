export {
  createMcpStreamableHttpHandler,
  type McpRequestHandler,
} from "./createServer.ts";
import { RENAME_FOLDER } from "@smm/types/ai-tools/renameFolder";
import { RENAME_EPISODE_FILE } from "@smm/types/ai-tools/renameEpisodeFile";
import { SCRAPE } from "@smm/types/ai-tools/scrape";
import { GET_JOB } from "@smm/types/ai-tools/getJob";
import { TMDB_SEARCH } from "@smm/types/ai-tools/tmdbSearch";
import { TMDB_GET_MOVIE } from "@smm/types/ai-tools/tmdbGetMovie";
import { TMDB_GET_TV_SHOW } from "@smm/types/ai-tools/tmdbGetTvShow";
export {
  createErrorResponse,
  createSuccessResponse,
} from "./response.ts";
export type { McpConfig, McpToolResponse } from "./types.ts";
export type {
  McpLifecycleManager,
  McpServerState,
  McpServerStatus,
  StartMcpOptions,
} from "./lifecycleTypes.ts";
export {
  applyMcpLifecycleFromConfig,
  doMcpGetStatus,
  doMcpStart,
  doMcpStop,
  parseStartOptionsFromBody,
  type McpLifecycleResult,
  type McpStartRequestBody,
} from "./lifecycle.ts";
export {
  getMcpServerStatusWithUserConfig,
  startMcpServerWithUserConfig,
  stopMcpServerWithUserConfig,
  type McpServerStateResponse,
  type McpServerOperationOptions,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
} from "./mcpServerConfig.ts";

/**
 * Re-exported tool-name constants so consumers that already depend
 * on `@smm/core-routes` (e.g. `apps/cli`) can reference them
 * without resolving `@smm/core` directly.
 */
export { RENAME_FOLDER };
export { RENAME_EPISODE_FILE };
export { SCRAPE };
export { GET_JOB };
export { TMDB_SEARCH, TMDB_GET_MOVIE, TMDB_GET_TV_SHOW };

/**
 * Constants exposed to hosts that load `core-routes.js` as a
 * single bundle (e.g. `apps/ohos`) and therefore cannot resolve
 * `@smm/core` directly at build time. Keep in sync with the
 * tool-name constants under `@smm/types/ai-tools/*`.
 */
export const MCP_TOOL_NAMES = {
  RENAME_FOLDER,
  RENAME_EPISODE_FILE,
  SCRAPE,
  GET_JOB,
  TMDB_SEARCH,
  TMDB_GET_MOVIE,
  TMDB_GET_TV_SHOW,
} as const;
