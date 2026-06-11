/**
 * Node http integration for the reverse proxy.
 *
 * Bridges `IncomingMessage` / `ServerResponse` (Node `http`) to the Web
 * Fetch `Request` / `Response` API used by {@link handleProxyRequest}, and
 * provides a self-contained lifecycle manager ({@link createReverseProxyManager})
 * that handles port scanning and `http.Server` start/stop.
 *
 * No external dependencies. Compatible with any Node 18+ runtime.
 */

import http from "node:http";
import net from "node:net";
import { Readable } from "node:stream";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import {
  handleProxyRequest,
  PORT_RANGE_END,
  PORT_RANGE_START,
  type ReverseProxyConfig,
} from "./reverseProxy.ts";
/**
 * Create a Node `http` request handler that forwards to
 * {@link handleProxyRequest}. Use with `http.createServer(handler)` or
 * compose into an existing server (e.g. mount on `/tmdb` and `/tvdb` paths
 * in the HarmonyOS Electron main process).
 */
export function createReverseProxyRequestHandler(
  config: ReverseProxyConfig = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const webRequest = incomingMessageToRequest(req);
      const webResponse = await handleProxyRequest(webRequest, config);
      await sendNodeResponse(res, webResponse);
    } catch (error) {
      // Defensive: handleProxyRequest should never throw, but if a host
      // error slips through, surface a 500 rather than leaving the
      // connection hanging.
      const logger = config.logger;
      if (logger) {
        logger.error(
          { err: error, method: req.method, url: req.url },
          "[Reverse Proxy] node handler error",
        );
      }
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    }
  };
}

/**
 * Convert a Node `IncomingMessage` to a Web `Request`. Body is streamed
 * lazily via `Readable.toWeb` so non-GET requests can be forwarded without
 * buffering the entire payload.
 */
function incomingMessageToRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "127.0.0.1";
  const url = `http://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  copyIncomingHeaders(req.headers, headers);

  const method = req.method ?? "GET";
  const init: RequestInit = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    // Node 18+ requires `duplex: "half"` when streaming a request body
    // through undici. See https://undici.nodejs.org/#/docs/api/Request
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }

  return new Request(url, init);
}

function copyIncomingHeaders(
  source: IncomingHttpHeaders,
  target: Headers,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) target.append(key, v);
    } else {
      target.set(key, value);
    }
  }
}

async function sendNodeResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  const body =
    response.body === null ? null : Buffer.from(await response.arrayBuffer());

  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "content-length" || lowerKey === "content-encoding") {
      return;
    }
    try {
      res.setHeader(key, value);
    } catch {
      // ignore
    }
  });

  if (body === null || body.length === 0) {
    res.end();
    return;
  }

  res.setHeader("Content-Length", body.length);
  res.end(body);
}

/**
 * Try to bind a port on 127.0.0.1. Resolves to `true` if the port was free
 * and could be bound, `false` otherwise.
 */
function tryListen(port: number, hostname = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => {
      tester.removeAllListeners();
      resolve(false);
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, hostname);
  });
}

/**
 * Scan the configured port range for a free port. Throws if no port is
 * available in the range.
 */
export async function findAvailableReverseProxyPort(
  reservedPorts: ReadonlySet<number> = new Set(),
  portRange: { start: number; end: number } = {
    start: PORT_RANGE_START,
    end: PORT_RANGE_END,
  },
): Promise<number> {
  for (let port = portRange.start; port <= portRange.end; port++) {
    if (reservedPorts.has(port)) continue;
    if (await tryListen(port)) return port;
  }
  throw new Error(
    `Could not find an available port in range ${portRange.start}-${portRange.end}`,
  );
}

export interface ReverseProxyManager {
  /** The base URL of the running proxy (e.g. `http://127.0.0.1:30001`), or `null` if not started. */
  readonly url: string | null;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Create a self-contained reverse proxy manager. Owns a `http.Server`
 * instance, manages its lifecycle, and exposes the listening URL via the
 * `url` getter.
 *
 * The `config` field mirrors {@link ReverseProxyConfig} plus an optional
 * explicit `port` for tests (skips the port scan and binds directly).
 */
export interface ReverseProxyManagerConfig extends ReverseProxyConfig {
  /** Force a specific port; bypasses scanning when set. */
  port?: number;
}

export function createReverseProxyManager(
  config: ReverseProxyManagerConfig = {},
): ReverseProxyManager {
  let server: http.Server | null = null;
  let currentUrl: string | null = null;

  const handler = createReverseProxyRequestHandler(config);

  async function start(): Promise<void> {
    if (server) {
      config.logger?.warn({}, "[Reverse Proxy] already running");
      return;
    }

    let port: number;
    try {
      if (typeof config.port === "number") {
        port = config.port;
      } else {
        port = await findAvailableReverseProxyPort(
          config.reservedPorts,
          config.portRange,
        );
      }
    } catch (error) {
      config.logger?.error(
        { err: error },
        "[Reverse Proxy] failed to find available port",
      );
      currentUrl = null;
      return;
    }

    const newServer = http.createServer(handler);
    await new Promise<void>((resolve, reject) => {
      newServer.once("error", (err) => {
        newServer.removeListener("listening", onListening);
        reject(err);
      });
      const onListening = () => {
        newServer.removeListener("error", onError);
        resolve();
      };
      const onError = (err: Error) => reject(err);
      newServer.once("listening", onListening);
      newServer.listen(port, "127.0.0.1");
    });

    server = newServer;
    currentUrl = `http://127.0.0.1:${port}`;
    config.logger?.info(
      { url: currentUrl },
      "[Reverse Proxy] started",
    );
  }

  async function stop(): Promise<void> {
    if (!server) return;
    const s = server;
    server = null;
    currentUrl = null;
    await new Promise<void>((resolve) => {
      s.close(() => resolve());
      // close() releases the listening socket immediately; existing
      // connections are drained. We don't forcibly destroy them.
    });
    config.logger?.info({}, "[Reverse Proxy] stopped");
  }

  return {
    get url() {
      return currentUrl;
    },
    start,
    stop,
  };
}
