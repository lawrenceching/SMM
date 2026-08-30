import type { UserConfig as UserConfigData } from "@smm/types";
import type { McpServerPort, McpServerState } from "../ports/McpServerPort";
import type { UserConfigHelper } from "./userConfigHelper";

export const DEFAULT_MCP_HOST = "127.0.0.1";
export const DEFAULT_MCP_PORT = 30001;

export interface StartMcpServerOptions {
  hostname?: string;
  port?: number;
}

export interface McpServerOperationOptions {
  /** When false, runtime is updated but smm.json MCP fields are not written (boot path). */
  persistUserConfig?: boolean;
}

export function resolveMcpStartOptions(
  config: UserConfigData,
  options?: StartMcpServerOptions,
): { hostname: string; port: number } {
  return {
    hostname: options?.hostname ?? config.mcpHost ?? DEFAULT_MCP_HOST,
    port: options?.port ?? config.mcpPort ?? DEFAULT_MCP_PORT,
  };
}

export async function startMcpServerWithConfig(
  mcpServer: McpServerPort,
  userConfig: UserConfigHelper,
  options?: StartMcpServerOptions,
  operation?: McpServerOperationOptions,
): Promise<McpServerState> {
  const config = await userConfig.read();
  const { hostname, port } = resolveMcpStartOptions(config, options);

  await mcpServer.start({ hostname, port });

  if (operation?.persistUserConfig !== false) {
    await userConfig.update((current) => ({
      ...current,
      enableMcpServer: true,
      mcpHost: hostname,
      mcpPort: port,
    }));
  }

  return mcpServer.getState();
}

export async function stopMcpServerWithConfig(
  mcpServer: McpServerPort,
  userConfig: UserConfigHelper,
  operation?: McpServerOperationOptions,
): Promise<McpServerState> {
  try {
    await mcpServer.stop();
  } finally {
    if (operation?.persistUserConfig !== false) {
      await userConfig.update((current) => ({
        ...current,
        enableMcpServer: false,
      }));
    }
  }

  return mcpServer.getState();
}

export async function getMcpServerStatusWithConfig(
  mcpServer: McpServerPort,
  userConfig: UserConfigHelper,
): Promise<McpServerState> {
  const state = mcpServer.getState();

  if (state.status !== "running") {
    const config = await userConfig.read();
    if (config.enableMcpServer) {
      await userConfig.update((current) => ({
        ...current,
        enableMcpServer: false,
      }));
    }
  }

  return state;
}
