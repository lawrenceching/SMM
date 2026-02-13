import { getUserConfig } from "@/utils/config";
import { getMcpStreamableHttpHandler } from "./mcp";
import { logger } from "../../lib/logger";

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 30001;

let mcpServer: ReturnType<typeof Bun.serve> | null = null;

/**
 * Applies MCP server config from user config: stops any running MCP server,
 * then starts one on mcpHost:mcpPort if enableMcpServer is true.
 */
export async function applyMcpConfig(): Promise<void> {
  let userConfig;
  try {
    userConfig = await getUserConfig();
  } catch (err) {
    logger.warn({ err }, "applyMcpConfig: failed to read user config, skipping MCP update");
    return;
  }

  if (mcpServer) {
    mcpServer.stop();
    mcpServer = null;
    logger.info("MCP server stopped");
  }

  if (userConfig.enableMcpServer !== true) {
    return;
  }

  const hostname = userConfig.mcpHost ?? DEFAULT_MCP_HOST;
  const port = userConfig.mcpPort ?? DEFAULT_MCP_PORT;

  try {
    const handler = await getMcpStreamableHttpHandler();
    mcpServer = Bun.serve({
      hostname,
      port,
      fetch: handler,
    });
    logger.info({ hostname, port: mcpServer.port }, "MCP server started");
  } catch (err) {
    logger.error({ err, hostname, port }, "MCP server failed to start");
  }
}
