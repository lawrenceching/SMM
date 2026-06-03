import { getUserConfig } from "@/utils/config";
import { getMcpStreamableHttpHandler, resetMcpStreamableHttpHandler } from "./mcp";
import { logger } from "../../lib/logger";

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 30001;

let mcpServer: ReturnType<typeof Bun.serve> | null = null;
let mcpServerError: string | null = null;

export type McpServerStatus = "running" | "stopped" | "error";

export interface McpServerState {
  status: McpServerStatus;
  host?: string;
  port?: number;
  error?: string;
}

/**
 * Returns the current MCP server runtime state.
 * Does not read from user config — purely reflects the in-memory server state.
 */
export function getMcpServerState(): McpServerState {
  if (mcpServer) {
    return {
      status: "running",
      host: mcpServer.hostname,
      port: mcpServer.port,
    };
  }
  if (mcpServerError) {
    return { status: "error", error: mcpServerError };
  }
  return { status: "stopped" };
}

/**
 * Starts the MCP HTTP server on the given hostname and port.
 * Falls back to user config values (or defaults) for omitted options.
 * Throws on failure; the caller is responsible for reporting the error.
 */
export async function startMcpServer(options?: {
  hostname?: string;
  port?: number;
}): Promise<void> {
  const userConfig = await getUserConfig();

  // Stop any running instance first
  if (mcpServer) {
    mcpServer.stop();
    mcpServer = null;
  }
  mcpServerError = null;

  // Reset handler cache so a fresh handler is created (allows recovery from previous failures)
  resetMcpStreamableHttpHandler();

  const hostname = options?.hostname ?? userConfig.mcpHost ?? DEFAULT_MCP_HOST;
  const port = options?.port ?? userConfig.mcpPort ?? DEFAULT_MCP_PORT;

  const handler = await getMcpStreamableHttpHandler();
  mcpServer = Bun.serve({
    hostname,
    port,
    fetch: handler,
  });
  logger.info({ hostname, port: mcpServer.port }, "MCP server started");
}

/**
 * Stops the MCP HTTP server if it is running.
 * Resets the handler cache so the next start builds a fresh handler.
 */
export async function stopMcpServer(): Promise<void> {
  if (mcpServer) {
    mcpServer.stop();
    mcpServer = null;
  }
  mcpServerError = null;
  resetMcpStreamableHttpHandler();
  logger.info("MCP server stopped");
}

/**
 * Reads user config and starts or stops the MCP server accordingly.
 * This is used once at CLI startup to honour the persisted enableMcpServer setting.
 * Unlike the old applyMcpConfig, this function re-throws errors so callers
 * can handle them.
 */
export async function applyMcpConfig(): Promise<void> {
  let userConfig;
  try {
    userConfig = await getUserConfig();
  } catch (err) {
    logger.warn({ err }, "applyMcpConfig: failed to read user config, skipping MCP update");
    return;
  }

  if (!userConfig.enableMcpServer) {
    await stopMcpServer();
    return;
  }

  try {
    await startMcpServer({
      hostname: userConfig.mcpHost,
      port: userConfig.mcpPort,
    });
  } catch (err) {
    mcpServerError = err instanceof Error ? err.message : String(err);
    logger.error({ err, hostname: userConfig.mcpHost, port: userConfig.mcpPort }, "MCP server failed to start");
    throw err;
  }
}
