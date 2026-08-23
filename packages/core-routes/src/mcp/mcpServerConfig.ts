import type { UserConfig } from "@smm/core/types";
import type { CoreRoutesConfig } from "../types.ts";
import { readUserConfig, writeUserConfigToDisk } from "../userConfig.ts";
import type { McpLifecycleManager, McpServerState, StartMcpOptions } from "./lifecycleTypes.ts";
import { parseStartOptionsFromBody } from "./lifecycle.ts";

export const DEFAULT_MCP_HOST = "127.0.0.1";
export const DEFAULT_MCP_PORT = 30001;

export interface McpServerStateResponse {
  data?: McpServerState;
  error?: string | null;
}

export interface McpServerOperationOptions {
  /** When false, runtime is updated but smm.json MCP fields are not written (boot path). */
  persistUserConfig?: boolean;
}

function mcpErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveMcpStartOptions(
  config: UserConfig,
  options?: StartMcpOptions,
): { hostname: string; port: number } {
  return {
    hostname: options?.hostname ?? config.mcpHost ?? DEFAULT_MCP_HOST,
    port: options?.port ?? config.mcpPort ?? DEFAULT_MCP_PORT,
  };
}

export async function startMcpServerWithUserConfig(
  manager: McpLifecycleManager,
  routesConfig: CoreRoutesConfig,
  body: unknown,
  operation?: McpServerOperationOptions,
): Promise<McpServerStateResponse> {
  const options = parseStartOptionsFromBody(body);
  const userConfig = await readUserConfig(routesConfig);
  const { hostname, port } = resolveMcpStartOptions(userConfig, options);

  try {
    await manager.start({ hostname, port });
    const state = manager.getState();
    if (state.status === "error") {
      return {
        data: state,
        error: `Error Reason: ${state.error ?? "Failed to start MCP server"}`,
      };
    }

    if (operation?.persistUserConfig !== false) {
      await writeUserConfigToDisk(routesConfig, {
        ...userConfig,
        enableMcpServer: true,
        mcpHost: hostname,
        mcpPort: port,
      });
    }

    return { data: state, error: null };
  } catch (error) {
    const message = mcpErrorMessage(error);
    const state = manager.getState();
    return {
      data: { ...state, status: "error", error: message },
      error: `Error Reason: ${message}`,
    };
  }
}

export async function stopMcpServerWithUserConfig(
  manager: McpLifecycleManager,
  routesConfig: CoreRoutesConfig,
  operation?: McpServerOperationOptions,
): Promise<McpServerStateResponse> {
  const userConfig = await readUserConfig(routesConfig);

  try {
    await manager.stop();
    const state = manager.getState();
    if (state.status === "error") {
      return {
        data: state,
        error: `Error Reason: ${state.error ?? "Failed to stop MCP server"}`,
      };
    }
    return { data: state, error: null };
  } catch (error) {
    const message = mcpErrorMessage(error);
    return {
      data: { status: "error", error: message },
      error: `Error Reason: ${message}`,
    };
  } finally {
    if (operation?.persistUserConfig !== false) {
      await writeUserConfigToDisk(routesConfig, {
        ...userConfig,
        enableMcpServer: false,
      });
    }
  }
}

export async function getMcpServerStatusWithUserConfig(
  manager: McpLifecycleManager,
  routesConfig: CoreRoutesConfig,
): Promise<McpServerStateResponse> {
  const state = manager.getState();

  if (state.status !== "running") {
    const userConfig = await readUserConfig(routesConfig);
    if (userConfig.enableMcpServer) {
      await writeUserConfigToDisk(routesConfig, {
        ...userConfig,
        enableMcpServer: false,
      });
    }
  }

  return { data: state, error: null };
}
