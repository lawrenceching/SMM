import type { McpLifecycleManager } from "@smm/core-routes";
import { getBunMcpServerPort } from "./BunMcpServerPort";

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
