export {
  createMcpStreamableHttpHandler,
  type McpRequestHandler,
} from "./createServer.ts";
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder";
import { RENAME_EPISODE_FILE } from "@smm/core/types/ai-tools/renameEpisodeFile";
import { SCRAPE } from "@smm/core/types/ai-tools/scrape";
import { GET_JOB } from "@smm/core/types/ai-tools/getJob";
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
  type McpLifecycleResult,
  type McpStartRequestBody,
} from "./lifecycle.ts";

/**
 * Re-exported tool-name constants so consumers that already depend
 * on `@smm/core-routes` (e.g. `apps/cli`) can reference them
 * without resolving `@smm/core` directly.
 */
export { RENAME_FOLDER };
export { RENAME_EPISODE_FILE };
export { SCRAPE };
export { GET_JOB };

/**
 * Constants exposed to hosts that load `core-routes.js` as a
 * single bundle (e.g. `apps/ohos`) and therefore cannot resolve
 * `@smm/core` directly at build time. Keep in sync with the
 * tool-name constants under `@smm/core/types/ai-tools/*`.
 */
export const MCP_TOOL_NAMES = {
  RENAME_FOLDER,
  RENAME_EPISODE_FILE,
  SCRAPE,
  GET_JOB,
} as const;
