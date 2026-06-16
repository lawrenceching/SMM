/**
 * Node `http` / `https` fetch implementation for environments where the
 * global `fetch` (undici) is unavailable or broken — e.g. OHOS Electron where
 * WebAssembly is not defined.
 *
 * Unlike browser fetch, Node's HTTP client does not decompress response
 * bodies automatically, so gzip/deflate/br responses are decoded here before
 * returning a Web `Response`.
 */

import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

const HOP_BY_HOP_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const STRIPPED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  "content-encoding",
  "content-length",
]);

async function decompressBody(
  buf: Buffer,
  contentEncoding: string | string[] | undefined,
): Promise<Buffer> {
  if (!contentEncoding || typeof contentEncoding !== "string") {
    return buf;
  }

  const encoding = contentEncoding.split(",")[0]?.trim().toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") {
    return gunzip(buf);
  }
  if (encoding === "deflate") {
    return inflate(buf);
  }
  if (encoding === "br") {
    return brotliDecompress(buf);
  }
  return buf;
}

function buildOutgoingHeaders(request: Request): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(lowerKey)) return;
    // node:http does not auto-decompress; prefer identity upstream bodies.
    if (lowerKey === "accept-encoding") return;
    headers[key] = value;
  });
  return headers;
}

function buildResponseHeaders(
  source: http.IncomingHttpHeaders,
  bodyLength: number,
): Headers {
  const headers = new Headers();
  for (const [key, val] of Object.entries(source)) {
    if (val === undefined) continue;
    const lowerKey = key.toLowerCase();
    if (STRIPPED_RESPONSE_HEADERS.has(lowerKey)) continue;
    if (Array.isArray(val)) {
      for (const v of val) headers.append(key, v);
    } else {
      headers.append(key, val);
    }
  }
  headers.set("Content-Length", String(bodyLength));
  return headers;
}

function requestViaNodeHttp(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";
  if (!isHttps && url.protocol !== "http:") {
    return Promise.reject(new Error(`Unsupported URL protocol: ${url.protocol}`));
  }

  const method = request.method.toUpperCase();
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const pathWithQuery = `${url.pathname}${url.search}`;
  const headers = buildOutgoingHeaders(request);

  return new Promise((resolve, reject) => {
    const onResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        void (async () => {
          try {
            const wireBody = Buffer.concat(chunks);
            const body = await decompressBody(wireBody, res.headers["content-encoding"]);
            const bodyBytes = Buffer.from(body);
            resolve(
              new Response(bodyBytes, {
                status: res.statusCode ?? 502,
                statusText: res.statusMessage ?? "",
                headers: buildResponseHeaders(res.headers, bodyBytes.length),
              }),
            );
          } catch (error) {
            reject(error);
          }
        })();
      });
      res.on("error", reject);
    };

    void (async () => {
      try {
        let requestBody: Buffer | undefined;
        if (method !== "GET" && method !== "HEAD") {
          requestBody = Buffer.from(await request.arrayBuffer());
        }

        const requestOptions: http.RequestOptions = {
          hostname: url.hostname,
          port,
          path: pathWithQuery,
          method: request.method,
          headers,
        };

        const req = isHttps
          ? https.request(requestOptions, onResponse)
          : http.request(requestOptions, onResponse);

        req.on("error", reject);
        if (requestBody !== undefined && requestBody.length > 0) {
          req.write(requestBody);
        }
        req.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}

/**
 * Returns a `fetch`-compatible function backed by `node:http` / `node:https`.
 * Use as `fetchImpl` in {@link ReverseProxyConfig} or {@link CoreRoutesConfig}
 * on runtimes without working global `fetch`.
 */
export function createNodeHttpFetch(): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request ? input : new Request(input, init);
    return requestViaNodeHttp(request);
  };
}
