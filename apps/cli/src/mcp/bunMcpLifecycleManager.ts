import type { McpLifecycleManager } from "@smm/core-routes";
import { getBunMcpServerPort, setBunMcpServerError } from "./BunMcpServerPort";

export type { McpServerState } from "core-app";
export type McpServerStatus = "running" | "stopped" | "error";

export { getBunMcpServerPort, setBunMcpServerError };

/**
 * MCP lifecycle manager for core-routes HTTP handlers and legacy callers.
 * Delegates runtime + UserConfig persistence to Core.
 */
export function getBunMcpLifecycleManager(): McpLifecycleManager {
  return {
    async start(options) {
      const { getCore } = await import("@/core/getCore");
      await getCore().startMcpServer(
        { hostname: options?.hostname, port: options?.port },
        { persistUserConfig: true },
      );
    },
    async stop() {
      const { getCore } = await import("@/core/getCore");
      await getCore().stopMcpServer({ persistUserConfig: true });
    },
    getState() {
      return getBunMcpServerPort().getState();
    },
  };
}

/** @deprecated Use {@link getBunMcpLifecycleManager}.getState() via Core */
export function getMcpServerState() {
  return getBunMcpServerPort().getState();
}

/** @deprecated Use Core.startMcpServer */
export async function startMcpServer(options?: {
  hostname?: string;
  port?: number;
}): Promise<void> {
  const { getCore } = await import("@/core/getCore");
  await getCore().startMcpServer(options, { persistUserConfig: true });
}

/** @deprecated Use Core.stopMcpServer */
export async function stopMcpServer(): Promise<void> {
  const { getCore } = await import("@/core/getCore");
  await getCore().stopMcpServer({ persistUserConfig: true });
}
