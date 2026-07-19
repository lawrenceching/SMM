import type { IncomingMessage, ServerResponse } from "node:http";
import {
  doFetchDiscoverConfig,
  EMPTY_DISCOVER_CONFIG,
  type DiscoverResponseBody,
} from "../discover.ts";
import { sendJson } from "../http.ts";
import type { RouteContext } from "../types.ts";

/**
 * Node `http` handler for `GET /api/discover`.
 *
 * Fetches and normalizes the remote SMM discovery config (media database
 * endpoints + reverse proxies). On any remote/fetch failure the shared
 * helper returns empty lists so the UI can fall back gracefully — this
 * route itself should almost always respond `200 { data }`.
 */
export async function handleDiscoverGet(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "GET" || ctx.url.pathname !== "/api/discover") {
    return false;
  }

  try {
    const config = await doFetchDiscoverConfig({
      logger: ctx.config.logger,
      fetchImpl: ctx.config.fetchImpl,
    });
    const body: DiscoverResponseBody = { data: config };
    sendJson(res, 200, body);
    return true;
  } catch (error) {
    // doFetchDiscoverConfig should never throw; this is a last-resort guard.
    const message = error instanceof Error ? error.message : String(error);
    ctx.config.logger?.error(
      { error: message },
      "[Discover] handleDiscoverGet unexpected throw",
    );
    sendJson(res, 200, { data: { ...EMPTY_DISCOVER_CONFIG } });
    return true;
  }
}
