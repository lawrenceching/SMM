import type { IncomingMessage, ServerResponse } from "node:http";
import { logAccess } from "./accessLog.ts";
import type { CoreRoutesLogger } from "./types.ts";

export interface HttpAccessLogOptions {
  logger: CoreRoutesLogger | undefined;
  /**
   * When true the raw query string is attached to the entry. Hosts
   * pass `() => logger.isLevelEnabled("debug")` so queries (which can
   * carry upstream api keys) never hit info-level smm.log.
   */
  isDebugEnabled?: () => boolean;
}

/**
 * Only API-ish requests are logged. Excludes static assets, the
 * `/socket.io/` polling transport, `/proxy/*` (the loopback `/api/*`
 * hop is logged instead) and the high-frequency `/api/log` beacon.
 */
export function shouldLogHttpAccess(pathname: string): boolean {
  return pathname.startsWith("/api/") && pathname !== "/api/log";
}

/**
 * Attach one `msg:"access"` entry per completed HTTP exchange at the
 * `http.createServer` choke point. Covers both the core-routes
 * dispatch and the Hono sub-app. Logs on `finish`; a `close` before
 * `finish` logs a single aborted entry instead.
 */
export function attachHttpAccessLog(
  req: IncomingMessage,
  res: ServerResponse,
  options: HttpAccessLogOptions,
): void {
  if (!options.logger) return;

  const rawUrl = req.url ?? "/";
  const queryIndex = rawUrl.indexOf("?");
  const path = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  if (!shouldLogHttpAccess(path)) return;

  const method = req.method ?? "GET";
  const started = performance.now();
  let finished = false;

  const emit = (outcome: "ok" | "error", aborted?: boolean) => {
    logAccess(options.logger, {
      source: "http",
      method,
      path,
      status: res.statusCode,
      outcome,
      ...(aborted ? { aborted: true } : {}),
      ...(options.isDebugEnabled?.() && queryIndex !== -1
        ? { query: rawUrl.slice(queryIndex + 1) }
        : {}),
      durationMs: Math.round(performance.now() - started),
    });
  };

  res.on("finish", () => {
    finished = true;
    emit(res.statusCode < 400 ? "ok" : "error");
  });
  res.on("close", () => {
    if (finished) return;
    emit("error", true);
  });
}
