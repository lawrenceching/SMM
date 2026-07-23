/**
 * Decode Content-Encoding for Node `http` responses so callers get a Fetch-like
 * Response with a plaintext body (same semantics as Undici / Bun fetch).
 */

import zlib from "node:zlib";
import { promisify } from "node:util";
import type http from "node:http";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

export async function decompressBody(
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

/** Map Node 304 to 200 so `new Response` is constructible (same as nodeHttpFetch). */
function toFetchApiStatus(statusCode: number | undefined): number {
  const status = statusCode ?? 502;
  if (status === 304) return 200;
  return status;
}

function incomingHeadersToObject(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (val === undefined) continue;
    const lower = key.toLowerCase();
    // Body is decoded below — strip encoding/length so clients don't double-decode.
    if (lower === "content-encoding" || lower === "content-length") continue;
    if (Array.isArray(val)) {
      result[key] = val.join(", ");
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Build a Fetch `Response` from a buffered Node HTTP response, decompressing
 * gzip / deflate / brotli when `Content-Encoding` is set.
 */
export async function nodeHttpMessageToFetchResponse(
  res: Pick<http.IncomingMessage, "statusCode" | "statusMessage" | "headers">,
  wireBody: Buffer,
): Promise<Response> {
  const body = await decompressBody(wireBody, res.headers["content-encoding"]);
  const headers = incomingHeadersToObject(res.headers);
  headers["Content-Length"] = String(body.length);
  return new Response(body, {
    status: toFetchApiStatus(res.statusCode),
    statusText: res.statusMessage ?? "",
    headers,
  });
}
