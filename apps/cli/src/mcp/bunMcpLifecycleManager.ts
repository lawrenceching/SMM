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
import {
  resolveMcpAdvertisedHost,
  resolveMcpBindAddress,
} from "@smm/core-routes";

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 30001;

let mcpServer: ReturnType<typeof Bun.serve> | null = null;
let mcpServerError: string | null = null;

function buildMcpUrl(host: string, port: number): string {
  return `http://${host}:${port}/mcp`;
}

function getRunningState(): McpServerState {
  const server = mcpServer!;
  const bindHost = server.hostname ?? DEFAULT_MCP_HOST;
  const advertisedHost = resolveMcpAdvertisedHost(bindHost);
  const port = server.port ?? DEFAULT_MCP_PORT;
  return {
    status: "running",
    host: advertisedHost,
    port,
    url: buildMcpUrl(advertisedHost, port),
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

    const requestedHostname =
      options?.hostname ?? userConfig.mcpHost ?? DEFAULT_MCP_HOST;
    const bindHostname = resolveMcpBindAddress(requestedHostname);
    const port = options?.port ?? userConfig.mcpPort ?? DEFAULT_MCP_PORT;

    const handler = await getMcpStreamableHttpHandler();
    mcpServer = Bun.serve({
      hostname: bindHostname,
      port,
      fetch: handler,
    });
    const advertisedHost = resolveMcpAdvertisedHost(mcpServer.hostname ?? bindHostname);
    const listeningPort = mcpServer.port ?? port;
    logger.info(
      {
        hostname: bindHostname,
        advertisedHost,
        port: listeningPort,
        url: buildMcpUrl(advertisedHost, listeningPort),
      },
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
