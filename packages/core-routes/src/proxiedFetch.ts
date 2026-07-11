/**
 * Proxied `fetch` implementation using Node.js built-in modules for HTTP
 * proxies and `socks-proxy-agent` for SOCKS5 proxies.
 *
 * Routes outgoing HTTP/HTTPS requests through an HTTP proxy
 * (HTTP CONNECT for HTTPS targets, direct forward-proxy for HTTP targets)
 * or through a SOCKS5 proxy (via `SocksProxyAgent`).
 *
 * Under Bun, HTTP(S) proxies use Bun's native `fetch({ proxy })` because
 * Bun ignores `http.request({ createConnection })`, which breaks the
 * Node CONNECT-tunnel path.
 *
 * External dependencies: `socks-proxy-agent` (for SOCKS5 support only).
 * HTTP proxy support uses only Node built-ins (`node:http`, `node:https`,
 * `node:net`, `node:tls`) when not running on Bun.
 */

import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { once } from "node:events";
import { SocksProxyAgent } from "socks-proxy-agent";

function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

export type OutboundProxyMode =
  | "bun-native"
  | "node-connect"
  | "node-forward"
  | "socks5";

export interface ProxiedFetchLogger {
  debug(obj: Record<string, unknown>, msg?: string): void;
}

/** Log-safe proxy endpoint (host:port only; credentials are never included). */
export function formatProxyHostForLog(proxyUrl: string): string {
  try {
    const u = new URL(proxyUrl);
    const defaultPort =
      u.protocol === "https:"
        ? "443"
        : u.protocol === "http:"
          ? "80"
          : "";
    const port = u.port || defaultPort;
    return port ? `${u.hostname}:${port}` : u.hostname;
  } catch {
    return "(invalid-proxy-url)";
  }
}

export function getOutboundProxyMode(
  proxyUrl: string,
  targetUrl?: string,
): OutboundProxyMode {
  const proxy = new URL(proxyUrl);
  if (proxy.protocol === "socks5:" || proxy.protocol === "socks5h:") {
    return "socks5";
  }
  if (isBunRuntime()) {
    return "bun-native";
  }
  if (targetUrl) {
    const target = new URL(targetUrl);
    if (target.protocol === "http:") {
      return "node-forward";
    }
  }
  return "node-connect";
}

function wrapFetchWithLogging(
  inner: (request: Request) => Promise<Response>,
  mode: OutboundProxyMode,
  logger?: ProxiedFetchLogger,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const target = new URL(request.url);
    logger?.debug(
      {
        proxyMode: mode,
        method: request.method,
        targetHost: target.host,
        targetPath: target.pathname,
      },
      "[ProxiedFetch] outbound request",
    );
    try {
      const response = await inner(request);
      logger?.debug(
        {
          proxyMode: mode,
          status: response.status,
          targetHost: target.host,
        },
        "[ProxiedFetch] outbound response",
      );
      return response;
    } catch (err) {
      logger?.debug(
        {
          proxyMode: mode,
          targetHost: target.host,
          err,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        "[ProxiedFetch] outbound failed",
      );
      throw err;
    }
  };
}

function nodeHeadersToObject(headers: http.IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      result[key] = val.join(", ");
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Read from a socket until \r\n\r\n (end of HTTP headers) is found.
 * Returns the raw header block as a string.
 */
function readHeaders(socket: net.Socket): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\r\n\r\n")) {
        socket.off("data", onData);
        socket.off("error", onError);
        resolve(data);
      }
    };
    const onError = (err: Error) => {
      socket.off("data", onData);
      socket.off("error", onError);
      reject(err);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

// ─── HTTP upstream → HTTP proxy (forward proxy) ─────────────────────

function httpForwardRequest(
  request: Request,
  proxyHost: string,
  proxyPort: number,
): Promise<Response> {
  const url = new URL(request.url);

  // Build headers — preserve originals but override Host to the upstream
  // so the upstream sees the correct virtual host.
  const headers = new Headers(request.headers);
  headers.set("Host", url.host);

  const method = request.method.toUpperCase();
  const isBodyAllowed = method !== "GET" && method !== "HEAD";

  return new Promise<Response>((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: proxyHost,
      port: proxyPort,
      // Forward proxy: request line contains the full URL
      path: request.url,
      method,
      headers: Object.fromEntries(headers.entries()),
      timeout: 30_000,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve(
          new Response(Buffer.concat(chunks), {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: nodeHeadersToObject(res.headers),
          }),
        );
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("HTTP proxy request timeout"));
    });

    if (isBodyAllowed) {
      void request.arrayBuffer().then((buf) => {
        req.write(Buffer.from(buf));
        req.end();
      }, reject);
    } else {
      req.end();
    }
  });
}

// ─── HTTPS upstream → HTTP proxy (CONNECT tunnel) ──────────────────

async function httpsTunnelRequest(
  request: Request,
  proxyHost: string,
  proxyPort: number,
): Promise<Response> {
  const url = new URL(request.url);
  const upstreamPort = url.port || 443;
  const method = request.method.toUpperCase();
  const isBodyAllowed = method !== "GET" && method !== "HEAD";

  // Step 1 — open TCP connection to proxy
  const socket = net.connect(proxyPort, proxyHost);
  await once(socket, "connect");

  // Step 2 — send CONNECT request
  const connectReq =
    `CONNECT ${url.hostname}:${upstreamPort} HTTP/1.1\r\n` +
    `Host: ${url.hostname}:${upstreamPort}\r\n` +
    "\r\n";
  socket.write(connectReq);

  // Step 3 — read CONNECT response
  const rawResp = await readHeaders(socket);
  const statusLine = rawResp.split("\r\n")[0] ?? "";
  if (!statusLine.includes("200")) {
    socket.destroy();
    throw new Error(`Proxy CONNECT refused: ${statusLine}`);
  }

  // Step 4 — upgrade TCP socket to TLS
  const tlsSocket = tls.connect({
    socket,
    host: url.hostname,
    servername: url.hostname,
  });
  await once(tlsSocket, "secureConnect");

  // Step 5 — send the actual HTTP request through the TLS tunnel.
  // Use `http.request` (NOT `https.request`) because the socket is
  // already TLS-wrapped.  `http.request` sends plain HTTP/1.1 over it,
  // which travels encrypted through the tunnel.
  const headers = new Headers(request.headers);
  headers.set("Host", url.host);

  return new Promise<Response>((resolve, reject) => {
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: upstreamPort,
      path: url.pathname + url.search,
      headers: Object.fromEntries(headers.entries()),
      createConnection: () => tlsSocket,
      timeout: 30_000,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve(
          new Response(Buffer.concat(chunks), {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: nodeHeadersToObject(res.headers),
          }),
        );
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("HTTPS tunnel request timeout"));
    });

    if (isBodyAllowed) {
      void request.arrayBuffer().then((buf) => {
        req.write(Buffer.from(buf));
        req.end();
      }, reject);
    } else {
      req.end();
    }
  });
}

// ─── SOCKS5 proxy (via socks-proxy-agent) ──────────────────────────

function socksProxyRequest(
  request: Request,
  proxyUrl: string,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const isBodyAllowed = method !== "GET" && method !== "HEAD";
  const isHttps = url.protocol === "https:";

  const headers = new Headers(request.headers);
  headers.set("Host", url.host);

  const agent = new SocksProxyAgent(proxyUrl);

  return new Promise<Response>((resolve, reject) => {
    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: Number(url.port) || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: Object.fromEntries(headers.entries()),
      agent,
      timeout: 30_000,
    };

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve(
          new Response(Buffer.concat(chunks), {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: nodeHeadersToObject(res.headers),
          }),
        );
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("SOCKS5 proxy request timeout"));
    });

    if (isBodyAllowed) {
      void request.arrayBuffer().then((buf) => {
        req.write(Buffer.from(buf));
        req.end();
      }, reject);
    } else {
      req.end();
    }
  });
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Create a `fetch`-compatible function that routes all requests through
 * the given proxy.
 *
 * @param proxyUrl  Proxy URL, e.g. `http://127.0.0.1:8081`,
 *                  `https://user:pass@proxy:8443`, or
 *                  `socks5://127.0.0.1:1080`.
 * @throws {Error}  If `proxyUrl` uses an unsupported scheme.
 */
export function createProxiedFetch(
  proxyUrl: string,
  logger?: ProxiedFetchLogger,
): typeof fetch {
  const proxy = new URL(proxyUrl);
  const isSocks = proxy.protocol === "socks5:" || proxy.protocol === "socks5h:";

  if (isSocks) {
    logger?.debug(
      {
        proxyMode: "socks5",
        httpProxyHost: formatProxyHostForLog(proxyUrl),
      },
      "[ProxiedFetch] using outbound proxy",
    );
    return wrapFetchWithLogging(
      (request) => socksProxyRequest(request, proxyUrl),
      "socks5",
      logger,
    );
  }

  if (proxy.protocol !== "http:" && proxy.protocol !== "https:") {
    throw new Error(`Unsupported proxy scheme: "${proxy.protocol}". Use http://, https://, or socks5://.`);
  }

  // Bun ignores Node's `http.request({ createConnection })`, so the CONNECT
  // tunnel path below never sends traffic through the proxy under Bun.
  // Bun's fetch accepts a `proxy` option and handles CONNECT correctly.
  if (isBunRuntime()) {
    logger?.debug(
      {
        proxyMode: "bun-native",
        httpProxyHost: formatProxyHostForLog(proxyUrl),
      },
      "[ProxiedFetch] using outbound proxy",
    );
    return wrapFetchWithLogging(
      async (request) => {
        const method = request.method;
        const headers = new Headers(request.headers);
        const body =
          method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD"
            ? await request.arrayBuffer()
            : undefined;
        return fetch(request.url, {
          method,
          headers,
          body,
          proxy: proxyUrl,
        } as RequestInit & { proxy: string });
      },
      "bun-native",
      logger,
    );
  }

  const proxyPort = Number(proxy.port) || (proxy.protocol === "https:" ? 443 : 80);
  const proxyHost = proxy.hostname;

  logger?.debug(
    {
      proxyMode: "node-connect",
      httpProxyHost: formatProxyHostForLog(proxyUrl),
    },
    "[ProxiedFetch] using outbound proxy",
  );

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const mode: OutboundProxyMode =
      url.protocol === "https:" ? "node-connect" : "node-forward";
    logger?.debug(
      {
        proxyMode: mode,
        method: request.method,
        targetHost: url.host,
        targetPath: url.pathname,
      },
      "[ProxiedFetch] outbound request",
    );
    try {
      const response = !url.protocol.startsWith("https:")
        ? await httpForwardRequest(request, proxyHost, proxyPort)
        : await httpsTunnelRequest(request, proxyHost, proxyPort);
      logger?.debug(
        { proxyMode: mode, status: response.status, targetHost: url.host },
        "[ProxiedFetch] outbound response",
      );
      return response;
    } catch (err) {
      logger?.debug(
        {
          proxyMode: mode,
          targetHost: url.host,
          err,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        "[ProxiedFetch] outbound failed",
      );
      throw err;
    }
  };
}
