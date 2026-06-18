import type { IncomingMessage, ServerResponse } from "node:http";
import {
  doMcpGetStatus,
  doMcpStart,
  doMcpStop,
} from "../mcp/lifecycle.ts";
import { readJsonBody, sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

export async function handleMcpStartPut(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "PUT" || ctx.url.pathname !== "/api/mcp/start") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "MCP lifecycle not configured" });
    return true;
  }

  const body = await readJsonBody(req);
  const result = await doMcpStart(manager, body);
  sendJson(res, result.status, result.body);
  return true;
}

export async function handleMcpStopPut(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "PUT" || ctx.url.pathname !== "/api/mcp/stop") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "MCP lifecycle not configured" });
    return true;
  }

  const result = await doMcpStop(manager);
  sendJson(res, result.status, result.body);
  return true;
}

export async function handleMcpStatusGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/mcp/status") {
    return false;
  }

  const manager = ctx.config.mcp?.manager;
  if (!manager) {
    sendJson(res, 200, { error: "MCP lifecycle not configured" });
    return true;
  }

  const result = doMcpGetStatus(manager);
  sendJson(res, result.status, result.body);
  return true;
}
