import { getUserConfig } from "@/utils/config";
import {
  getMcpStreamableHttpHandler,
  resetMcpStreamableHttpHandler,
} from "./mcp";
import { logger } from "../../lib/logger";
import type {
  McpLifecycleManager,
  McpServerState,
  StartMcpOptions,
} from "@smm/core-routes";

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 30001;

let mcpServer: ReturnType<typeof Bun.serve> | null = null;
let mcpServerError: string | null = null;

function buildMcpUrl(host: string, port: number): string {
  return `http://${host}:${port}/mcp`;
}

function getRunningState(): McpServerState {
  return {
    status: "running",
    host: mcpServer!.hostname,
    port: mcpServer!.port,
    url: buildMcpUrl(mcpServer!.hostname, mcpServer!.port),
  };
}

const bunMcpLifecycleManager: McpLifecycleManager = {
  async start(options?: StartMcpOptions): Promise<void> {
    const userConfig = await getUserConfig();

    if (mcpServer) {
      mcpServer.stop();
      mcpServer = null;
    }
    mcpServerError = null;
    resetMcpStreamableHttpHandler();

    const hostname =
      options?.hostname ?? userConfig.mcpHost ?? DEFAULT_MCP_HOST;
    const port = options?.port ?? userConfig.mcpPort ?? DEFAULT_MCP_PORT;

    const handler = await getMcpStreamableHttpHandler();
    mcpServer = Bun.serve({
      hostname,
      port,
      fetch: handler,
    });
    logger.info(
      { hostname, port: mcpServer.port, url: buildMcpUrl(mcpServer.hostname, mcpServer.port) },
      "MCP server started",
    );
  },

  async stop(): Promise<void> {
    if (mcpServer) {
      mcpServer.stop();
      mcpServer = null;
    }
    mcpServerError = null;
    resetMcpStreamableHttpHandler();
    logger.info("MCP server stopped");
  },

  getState(): McpServerState {
    if (mcpServer) {
      return getRunningState();
    }
    if (mcpServerError) {
      return { status: "error", error: mcpServerError };
    }
    return { status: "stopped" };
  },
};

/** Record a boot-time start failure for {@link getState}. */
export function setBunMcpServerError(message: string | null): void {
  mcpServerError = message;
}

export function getBunMcpLifecycleManager(): McpLifecycleManager {
  return bunMcpLifecycleManager;
}

/** @deprecated Use {@link getBunMcpLifecycleManager}.getState() */
export function getMcpServerState(): McpServerState {
  return bunMcpLifecycleManager.getState();
}

/** @deprecated Use {@link getBunMcpLifecycleManager}.start() */
export async function startMcpServer(options?: {
  hostname?: string;
  port?: number;
}): Promise<void> {
  await bunMcpLifecycleManager.start(options);
}

/** @deprecated Use {@link getBunMcpLifecycleManager}.stop() */
export async function stopMcpServer(): Promise<void> {
  await bunMcpLifecycleManager.stop();
}

export type { McpServerState };
export type McpServerStatus = McpServerState["status"];
