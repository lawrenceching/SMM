import { getCore } from "@/core/getCore";
import { logger } from "../../lib/logger";
import { setBunMcpServerError } from "./BunMcpServerPort";

export type { McpServerState, McpServerStatus } from "./bunMcpLifecycleManager";
export {
  getMcpServerState,
  startMcpServer,
  stopMcpServer,
  getBunMcpLifecycleManager,
  getBunMcpServerPort,
  setBunMcpServerError,
} from "./bunMcpLifecycleManager";

/**
 * Reads user config and starts or stops the MCP server accordingly.
 * Used at CLI HTTP server startup to honour the persisted enableMcpServer setting.
 * Does not rewrite smm.json on boot (config already reflects user intent).
 */
export async function applyMcpConfig(): Promise<void> {
  const core = getCore();
  try {
    const userConfig = await core.getUserConfig();
    if (!userConfig.enableMcpServer) {
      await core.stopMcpServer({ persistUserConfig: false });
      return;
    }

    await core.startMcpServer(
      { hostname: userConfig.mcpHost, port: userConfig.mcpPort },
      { persistUserConfig: false },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setBunMcpServerError(message);
    const userConfig = await core.getUserConfig().catch(() => null);
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
