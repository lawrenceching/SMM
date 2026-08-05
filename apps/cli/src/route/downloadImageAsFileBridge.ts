import type { HttpBindings } from "@hono/node-server";
import type { Hono } from "hono";
import {
  handleDownloadImageAsFilePost,
  type CoreRoutesConfig,
  type CoreRoutesLogger,
} from "@smm/core-routes";
import { buildAllowlist } from "@/utils/buildAllowlist";
import { logger } from "../../lib/logger";

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
};

/**
 * Hono mount for `POST /api/downloadImage` on the desktop CLI.
 *
 * Instead of a hand-rolled shell, this delegates to the shared
 * `handleDownloadImageAsFilePost` from `@smm/core-routes` — the same
 * handler the core-routes Node `http` server uses — by bridging to the
 * raw Node req/res that `@hono/node-server` exposes as `c.env`.
 * The allowlist is re-resolved on every request (via `resolveAllowlist`)
 * so folders imported after startup are honored.
 */
export function handleDownloadImageAsFileRequest(app: Hono) {
  const config: CoreRoutesConfig = {
    allowlist: [], // static fallback; resolveAllowlist supplies fresh values each request
    logger: coreRoutesLogger,
    resolveAllowlist: () => buildAllowlist(),
  };
  app.post("/api/downloadImage", async (c) => {
    const { incoming, outgoing } = c.env as HttpBindings;
    // Raw-outgoing writes bypass Hono's cors() middleware (which only sets
    // c.res.headers), so copy them onto the Node response before delegating.
    c.res.headers.forEach((value, key) => outgoing.setHeader(key, value));
    await handleDownloadImageAsFilePost(incoming, outgoing, {
      config,
      url: new URL(c.req.url),
    });
    return c.body(null, 200, { "x-hono-already-sent": "true" });
  });
}
