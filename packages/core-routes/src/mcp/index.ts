export {
  createMcpStreamableHttpHandler,
  type McpRequestHandler,
} from "./createServer.ts";
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder";
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

/**
 * Constants exposed to hosts that load `core-routes.js` as a
 * single bundle (e.g. `apps/ohos`) and therefore cannot resolve
 * `@smm/core` directly at build time. Keep in sync with the
 * tool-name constants under `@smm/core/types/ai-tools/*`.
 */
export const MCP_TOOL_NAMES = { RENAME_FOLDER } as const;
