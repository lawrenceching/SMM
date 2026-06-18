import { applyMcpLifecycleFromConfig } from "@smm/core-routes";
import { getUserConfig } from "@/utils/config";
import { logger } from "../../lib/logger";
import {
  getBunMcpLifecycleManager,
  setBunMcpServerError,
  getMcpServerState,
  startMcpServer,
  stopMcpServer,
} from "./bunMcpLifecycleManager";

export type { McpServerState, McpServerStatus } from "./bunMcpLifecycleManager";
export {
  getMcpServerState,
  startMcpServer,
  stopMcpServer,
  getBunMcpLifecycleManager,
};

/**
 * Reads user config and starts or stops the MCP server accordingly.
 * Used at CLI startup to honour the persisted enableMcpServer setting.
 */
export async function applyMcpConfig(): Promise<void> {
  try {
    await applyMcpLifecycleFromConfig(
      getBunMcpLifecycleManager(),
      getUserConfig,
      {
        debug: (obj, msg) => logger.debug(obj, msg),
        info: (obj, msg) => logger.info(obj, msg),
        warn: (obj, msg) => logger.warn(obj, msg),
        error: (obj, msg) => logger.error(obj, msg),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setBunMcpServerError(message);
    const userConfig = await getUserConfig().catch(() => null);
    logger.error(
      {
        err,
        hostname: userConfig?.mcpHost,
        port: userConfig?.mcpPort,
      },
      "MCP server failed to start",
    );
    throw err;
  }
}
