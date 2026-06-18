import { Hono } from "hono";
import { doMcpGetStatus, doMcpStart, doMcpStop } from "@smm/core-routes";
import { getBunMcpLifecycleManager } from "@/mcp/bunMcpLifecycleManager";
import { logger } from "../../lib/logger";

/**
 * Registers MCP server lifecycle routes via shared core-routes logic:
 *
 *   PUT /api/mcp/start   — starts the MCP HTTP server
 *   PUT /api/mcp/stop    — stops the MCP HTTP server
 *   GET  /api/mcp/status — returns the current server state
 */
export function handleMcpRoutes(app: Hono): void {
  const manager = getBunMcpLifecycleManager();

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
