/**
 * Proxied `fetch` implementation for HTTP(S) and SOCKS5 outbound proxies.
 *
 * - Bun: native `fetch({ proxy })` (Bun ignores Node CONNECT/`createConnection`).
 * - Node / OHOS: `https-proxy-agent` / `http-proxy-agent` for HTTP proxies,
 *   `socks-proxy-agent` for SOCKS5. Responses are decompressed like Undici
 *   (gzip / deflate / br) so reverse-proxy clients receive plaintext JSON.
 */

import http from "node:http";
import https from "node:https";
import type { Agent } from "node:http";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { nodeHttpMessageToFetchResponse } from "./httpContentEncoding.ts";
import { toRequest, type FetchInput, type FetchLike } from "./fetchInput.ts";

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
): FetchLike {
  return async (input: FetchInput, init?: RequestInit): Promise<Response> => {
    const request = toRequest(input, init);
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

/**
 * Outgoing headers for Node agent requests.
 * Drop Accept-Encoding so upstream prefers identity; still decompress if gzip arrives.
 */
function buildAgentRequestHeaders(request: Request): Record<string, string> {
  const headers = new Headers(request.headers);
  headers.delete("accept-encoding");
  headers.set("Host", new URL(request.url).host);
  return Object.fromEntries(headers.entries());
}

function requestViaAgent(
  request: Request,
  agent: Agent,
  timeoutMessage: string,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const isBodyAllowed = method !== "GET" && method !== "HEAD";
  const isHttps = url.protocol === "https:";
  const headers = buildAgentRequestHeaders(request);

  return new Promise<Response>((resolve, reject) => {
    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: Number(url.port) || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      agent,
      timeout: 30_000,
    };

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        void nodeHttpMessageToFetchResponse(res, Buffer.concat(chunks)).then(
          resolve,
          reject,
        );
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(timeoutMessage));
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

function httpProxyAgentRequest(request: Request, proxyUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";
  // HttpsProxyAgent: CONNECT tunnel for https:// targets.
  // HttpProxyAgent: absolute-URL forward for http:// targets.
  // Cast: agent packages type `http` vs `node:http` Agent incompatibly under strict TS.
  const agent = (isHttps
    ? new HttpsProxyAgent(proxyUrl)
    : new HttpProxyAgent(proxyUrl)) as unknown as Agent;
  return requestViaAgent(
    request,
    agent,
    isHttps ? "HTTPS proxy request timeout" : "HTTP proxy request timeout",
  );
}

function socksProxyRequest(request: Request, proxyUrl: string): Promise<Response> {
  return requestViaAgent(
    request,
    new SocksProxyAgent(proxyUrl) as unknown as Agent,
    "SOCKS5 proxy request timeout",
  );
}

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
): FetchLike {
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

  // Bun ignores Node's agent/`createConnection` CONNECT path; use native proxy.
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

  logger?.debug(
    {
      proxyMode: "node-connect",
      httpProxyHost: formatProxyHostForLog(proxyUrl),
    },
    "[ProxiedFetch] using outbound proxy",
  );

  return async (input: FetchInput, init?: RequestInit): Promise<Response> => {
    const request = toRequest(input, init);
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
      const response = await httpProxyAgentRequest(request, proxyUrl);
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
