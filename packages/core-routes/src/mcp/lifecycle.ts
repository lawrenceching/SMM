import type { UserConfig } from "@smm/core/types";
import type { CoreRoutesLogger } from "../types.ts";
import type {
  McpLifecycleManager,
  McpServerState,
  StartMcpOptions,
} from "./lifecycleTypes.ts";

export interface McpStartRequestBody {
  host?: string;
  port?: number;
}

export interface McpLifecycleResult {
  status: number;
  body: McpServerState;
}

function parseStartOptions(body: unknown): StartMcpOptions | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const record = body as McpStartRequestBody;
  const options: StartMcpOptions = {};
  if (typeof record.host === "string" && record.host.trim() !== "") {
    options.hostname = record.host;
  }
  if (typeof record.port === "number" && Number.isFinite(record.port)) {
    options.port = record.port;
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

export async function doMcpStart(
  manager: McpLifecycleManager,
  body: unknown,
): Promise<McpLifecycleResult> {
  try {
    const options = parseStartOptions(body);
    await manager.start(options);
    return { status: 200, body: manager.getState() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const state = manager.getState();
    return {
      status: 500,
      body: { ...state, error: message },
    };
  }
}

export async function doMcpStop(
  manager: McpLifecycleManager,
): Promise<McpLifecycleResult> {
  try {
    await manager.stop();
    return { status: 200, body: manager.getState() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 500,
      body: { status: "error", error: message },
    };
  }
}

export function doMcpGetStatus(manager: McpLifecycleManager): McpLifecycleResult {
  return { status: 200, body: manager.getState() };
}

/**
 * On host boot, honour `userConfig.enableMcpServer` by starting or
 * stopping the injected lifecycle manager.
 */
export async function applyMcpLifecycleFromConfig(
  manager: McpLifecycleManager,
  getUserConfig: () => Promise<UserConfig>,
  logger?: CoreRoutesLogger,
): Promise<void> {
  let userConfig: UserConfig;
  try {
    userConfig = await getUserConfig();
  } catch (err) {
    logger?.warn(
      { err },
      "applyMcpLifecycleFromConfig: failed to read user config, skipping MCP update",
    );
    return;
  }

  if (!userConfig.enableMcpServer) {
    await manager.stop();
    return;
  }

  try {
    await manager.start({
      hostname: userConfig.mcpHost,
      port: userConfig.mcpPort,
    });
  } catch (err) {
    logger?.error(
      {
        err,
        hostname: userConfig.mcpHost,
        port: userConfig.mcpPort,
      },
      "MCP server failed to start on boot",
    );
    throw err;
  }
}
