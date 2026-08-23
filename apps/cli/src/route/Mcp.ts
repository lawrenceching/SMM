import { Hono } from "hono";
import type { McpServerState } from "core-app";
import { doMcpGetStatus, doMcpStart, doMcpStop } from "@smm/core-routes";
import { getCore } from "@/core/getCore";
import { getBunMcpLifecycleManager } from "@/mcp/bunMcpLifecycleManager";
import { logger } from "../../lib/logger";

interface McpServerStateResponse {
  data?: McpServerState;
  error?: string | null;
}

function mcpErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseStartBody(body: unknown): { hostname?: string; port?: number } {
  if (!body || typeof body !== "object") {
    return {};
  }
  const record = body as { host?: unknown; port?: unknown };
  const options: { hostname?: string; port?: number } = {};
  if (typeof record.host === "string" && record.host.trim() !== "") {
    options.hostname = record.host;
  }
  if (typeof record.port === "number" && Number.isFinite(record.port)) {
    options.port = record.port;
  }
  return options;
}

/**
 * Registers MCP server lifecycle routes.
 *
 * RPC (Web UI):
 *   GET  /api/get-mcp-server-status
 *   POST /api/start-mcp-server
 *   POST /api/stop-mcp-server
 *
 * Legacy (OHOS / older clients):
 *   PUT /api/mcp/start | /api/mcp/stop
 *   GET /api/mcp/status
 */
export function handleMcpRoutes(app: Hono): void {
  const manager = getBunMcpLifecycleManager();

  app.get("/api/get-mcp-server-status", async (c) => {
    try {
      const state = await getCore().getMcpServerStatus();
      const ok: McpServerStateResponse = { data: state, error: null };
      return c.json(ok, 200);
    } catch (error) {
      logger.error({ error }, "GET /api/get-mcp-server-status failed");
      const err: McpServerStateResponse = {
        error: `Error Reason: ${mcpErrorMessage(error)}`,
      };
      return c.json(err, 200);
    }
  });

  app.post("/api/start-mcp-server", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const options = parseStartBody(body);
    try {
      const state = await getCore().startMcpServer(options, { persistUserConfig: true });
      if (state.status === "error") {
        const err: McpServerStateResponse = {
          data: state,
          error: `Error Reason: ${state.error ?? "Failed to start MCP server"}`,
        };
        logger.error({ state }, "POST /api/start-mcp-server failed");
        return c.json(err, 200);
      }
      const ok: McpServerStateResponse = { data: state, error: null };
      return c.json(ok, 200);
    } catch (error) {
      const message = mcpErrorMessage(error);
      logger.error({ error: message }, "POST /api/start-mcp-server failed");
      const state = getCore().getMcpServerState();
      const err: McpServerStateResponse = {
        data: { ...state, status: "error", error: message },
        error: `Error Reason: ${message}`,
      };
      return c.json(err, 200);
    }
  });

  app.post("/api/stop-mcp-server", async (c) => {
    try {
      const state = await getCore().stopMcpServer({ persistUserConfig: true });
      if (state.status === "error") {
        const err: McpServerStateResponse = {
          data: state,
          error: `Error Reason: ${state.error ?? "Failed to stop MCP server"}`,
        };
        logger.error({ state }, "POST /api/stop-mcp-server failed");
        return c.json(err, 200);
      }
      const ok: McpServerStateResponse = { data: state, error: null };
      return c.json(ok, 200);
    } catch (error) {
      const message = mcpErrorMessage(error);
      logger.error({ error: message }, "POST /api/stop-mcp-server failed");
      const err: McpServerStateResponse = {
        data: { status: "error", error: message },
        error: `Error Reason: ${message}`,
      };
      return c.json(err, 200);
    }
  });

  app.put("/api/mcp/start", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await doMcpStart(manager, body);
    if (result.status >= 400) {
      logger.error({ state: result.body }, "PUT /api/mcp/start failed");
    }
    return c.json(result.body, result.status as 200 | 500);
  });

  app.put("/api/mcp/stop", async (c) => {
    const result = await doMcpStop(manager);
    if (result.status >= 400) {
      logger.error({ err: result.body.error }, "PUT /api/mcp/stop failed");
    }
    return c.json(result.body, result.status as 200 | 500);
  });

  app.get("/api/mcp/status", (c) => {
    const result = doMcpGetStatus(manager);
    return c.json(result.body, 200);
  });
}
