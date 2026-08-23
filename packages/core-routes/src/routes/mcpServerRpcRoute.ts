import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getMcpServerStatusWithUserConfig,
  startMcpServerWithUserConfig,
  stopMcpServerWithUserConfig,
} from "../mcp/mcpServerConfig.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Web UI RPC routes (docs/dev/mcp.md):
 *   GET  /api/get-mcp-server-status
 *   POST /api/start-mcp-server
 *   POST /api/stop-mcp-server
 *
 * Response shape: `{ data?: McpServerState, error?: string | null }`
 */
export async function handleMcpGetServerStatusGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/get-mcp-server-status") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "Error Reason: MCP lifecycle not configured" });
    return true;
  }

  try {
    const result = await getMcpServerStatusWithUserConfig(manager, ctx.config);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 200, { error: `Error Reason: ${message}` });
  }
  return true;
}

export async function handleMcpStartPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/start-mcp-server") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "Error Reason: MCP lifecycle not configured" });
    return true;
  }

  const body = await readJsonBody(req);
  const result = await startMcpServerWithUserConfig(manager, ctx.config, body, {
    persistUserConfig: true,
  });
  sendJson(res, 200, result);
  return true;
}

export async function handleMcpStopPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/stop-mcp-server") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "Error Reason: MCP lifecycle not configured" });
    return true;
  }

  const result = await stopMcpServerWithUserConfig(manager, ctx.config, {
    persistUserConfig: true,
  });
  sendJson(res, 200, result);
  return true;
}
