import { getCore } from "@/core/getCore";
import { logger } from "../../lib/logger";
import { setBunMcpServerError } from "./BunMcpServerPort";
import { startupDiag } from "@/utils/startupDiag";

/**
 * Reads user config and starts or stops the MCP server accordingly.
 * Used at CLI HTTP server startup to honour the persisted enableMcpServer setting.
 * Does not rewrite smm.json on boot (config already reflects user intent).
 */
export async function applyMcpConfig(): Promise<void> {
  const core = getCore();
  try {
    const userConfig = await core.getUserConfig();
    startupDiag("mcp-config-begin", {
      enableMcpServer: userConfig.enableMcpServer === true,
      mcpHost: userConfig.mcpHost ?? null,
      mcpPort: userConfig.mcpPort ?? null,
    });
    if (!userConfig.enableMcpServer) {
      await core.stopMcpServer({ persistUserConfig: false });
      startupDiag("mcp-config-stop", { reason: "enableMcpServer=false" });
      return;
    }

    await core.startMcpServer(
      { hostname: userConfig.mcpHost, port: userConfig.mcpPort },
      { persistUserConfig: false },
    );
    const { getBunMcpServerPort } = await import("./BunMcpServerPort");
    const state = getBunMcpServerPort().getState();
    startupDiag("mcp-config-start", {
      status: state.status,
      host: "host" in state ? state.host : null,
      port: "port" in state ? state.port : null,
      url: "url" in state ? state.url : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setBunMcpServerError(message);
    const userConfig = await core.getUserConfig().catch(() => null);
    startupDiag("mcp-config-error", {
      message,
      hostname: userConfig?.mcpHost ?? null,
      port: userConfig?.mcpPort ?? null,
    });
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
