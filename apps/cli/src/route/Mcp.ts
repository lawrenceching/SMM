import { Hono } from "hono";
import { startMcpServer, stopMcpServer, getMcpServerState } from "@/mcp/mcpServerManager";
import { logger } from "../../lib/logger";
import type { McpServerState } from "@/mcp/mcpServerManager";

/**
 * Registers MCP server lifecycle routes:
 *
 *   PUT /api/mcp/start   — starts the MCP HTTP server
 *   PUT /api/mcp/stop    — stops the MCP HTTP server
 *   GET  /api/mcp/status — returns the current server state
 *
 * All three endpoints return a JSON {@link McpServerState} body.
 */
export function handleMcpRoutes(app: Hono): void {
  // ── Start ────────────────────────────────────────────────────
  app.put("/api/mcp/start", async (c) => {
    try {
      let hostname: string | undefined;
      let port: number | undefined;

      const body = await c.req.json().catch(() => ({}));
      if (typeof body.host === "string") hostname = body.host;
      if (typeof body.port === "number") port = body.port;

      await startMcpServer(hostname ? { hostname, port } : { port });

      const state: McpServerState = getMcpServerState();
      return c.json(state, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const state: McpServerState = getMcpServerState();
      logger.error({ err, state }, "PUT /api/mcp/start failed");
      return c.json({ ...state, error: message }, 500);
    }
  });

  // ── Stop ─────────────────────────────────────────────────────
  app.put("/api/mcp/stop", async (c) => {
    try {
      await stopMcpServer();
      const state: McpServerState = getMcpServerState();
      return c.json(state, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "PUT /api/mcp/stop failed");
      return c.json({ status: "error", error: message } as McpServerState, 500);
    }
  });

  // ── Status ───────────────────────────────────────────────────
  app.get("/api/mcp/status", (c) => {
    const state: McpServerState = getMcpServerState();
    return c.json(state, 200);
  });
}
