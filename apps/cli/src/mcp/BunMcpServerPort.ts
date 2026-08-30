import {
  getMcpStreamableHttpHandler,
  resetMcpStreamableHttpHandler,
} from "./mcp";
import { logger } from "../../lib/logger";
import type {
  McpServerPort,
  McpServerStartOptions,
  McpServerState,
} from "@smm/core";
import {
  resolveMcpAdvertisedHost,
  resolveMcpBindAddress,
} from "@smm/core-routes";

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 30001;

function buildMcpUrl(host: string, port: number): string {
  return `http://${host}:${port}/mcp`;
}

export class BunMcpServerPort implements McpServerPort {
  private mcpServer: ReturnType<typeof Bun.serve> | null = null;
  private lastError: string | null = null;

  setLastError(message: string | null): void {
    this.lastError = message;
  }

  async start(options: McpServerStartOptions): Promise<void> {
    if (this.mcpServer) {
      this.mcpServer.stop();
      this.mcpServer = null;
    }
    this.lastError = null;
    resetMcpStreamableHttpHandler();

    const bindHostname = resolveMcpBindAddress(options.hostname);
    const handler = await getMcpStreamableHttpHandler();
    this.mcpServer = Bun.serve({
      hostname: bindHostname,
      port: options.port,
      fetch: handler,
    });

    const advertisedHost = resolveMcpAdvertisedHost(
      this.mcpServer.hostname ?? bindHostname,
    );
    const listeningPort = this.mcpServer.port ?? options.port;
    logger.info(
      {
        hostname: bindHostname,
        advertisedHost,
        port: listeningPort,
        url: buildMcpUrl(advertisedHost, listeningPort),
      },
      "MCP server started",
    );
  }

  async stop(): Promise<void> {
    if (this.mcpServer) {
      this.mcpServer.stop();
      this.mcpServer = null;
    }
    this.lastError = null;
    resetMcpStreamableHttpHandler();
    logger.info("MCP server stopped");
  }

  getState(): McpServerState {
    if (this.mcpServer) {
      const bindHost = this.mcpServer.hostname ?? DEFAULT_MCP_HOST;
      const advertisedHost = resolveMcpAdvertisedHost(bindHost);
      const port = this.mcpServer.port ?? DEFAULT_MCP_PORT;
      return {
        status: "running",
        host: advertisedHost,
        port,
        url: buildMcpUrl(advertisedHost, port),
      };
    }
    if (this.lastError) {
      return { status: "error", error: this.lastError };
    }
    return { status: "stopped" };
  }
}

let bunMcpServerPort: BunMcpServerPort | undefined;

export function getBunMcpServerPort(): BunMcpServerPort {
  if (!bunMcpServerPort) {
    bunMcpServerPort = new BunMcpServerPort();
  }
  return bunMcpServerPort;
}

/** @deprecated Use {@link getBunMcpServerPort}.setLastError */
export function setBunMcpServerError(message: string | null): void {
  getBunMcpServerPort().setLastError(message);
}
