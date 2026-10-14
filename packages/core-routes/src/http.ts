import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";

/** Matches `apps/server/app.ts` Hono `/api/*` cache middleware. */
const EXPLICIT_HTTP_CACHE_RE = /\b(public|private|max-age|s-maxage|immutable)\b/;

export function allowsExplicitHttpCaching(cacheControl: string | undefined): boolean {
  return Boolean(cacheControl && EXPLICIT_HTTP_CACHE_RE.test(cacheControl));
}

function readResponseCacheControl(res: ServerResponse): string | undefined {
  const value = res.getHeader("Cache-Control");
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

function cacheControlFromWriteHeadArgs(args: unknown[]): string | undefined {
  if (args.length === 0) return undefined;
  const first = args[0];
  let headers: OutgoingHttpHeaders | undefined;
  if (typeof first === "string") {
    headers = args[1] as OutgoingHttpHeaders | undefined;
  } else if (typeof first === "object" && first !== null) {
    headers = first as OutgoingHttpHeaders;
  }
  if (!headers) return undefined;
  const raw = headers["Cache-Control"] ?? headers["cache-control"];
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  return String(raw);
}

function applyNoStoreUnlessExplicitCache(
  res: ServerResponse,
  pendingWriteHeadCacheControl?: string,
): void {
  if (res.headersSent) return;
  const cacheControl = pendingWriteHeadCacheControl ?? readResponseCacheControl(res);
  if (!allowsExplicitHttpCaching(cacheControl)) {
    res.setHeader("Cache-Control", "no-store");
  }
}

const cacheControlGuardKey = Symbol("coreRoutesCacheControlGuard");

/**
 * Ensures core-routes responses default to `Cache-Control: no-store`, except
 * handlers that opt into caching (e.g. `GET /api/image`). Patches `writeHead`
 * / `end` before headers flush; restores originals on `finish` / `close`.
 */
export function attachCoreRoutesCacheControlGuard(res: ServerResponse): void {
  const marked = res as ServerResponse & { [cacheControlGuardKey]?: boolean };
  if (marked[cacheControlGuardKey]) return;
  marked[cacheControlGuardKey] = true;

  const originalWriteHead = res.writeHead.bind(res);
  const originalEnd = res.end.bind(res);

  const restore = () => {
    res.writeHead = originalWriteHead;
    res.end = originalEnd;
    marked[cacheControlGuardKey] = false;
  };

  res.writeHead = function (statusCode: number, ...args: unknown[]) {
    const fromArgs = cacheControlFromWriteHeadArgs(args);
    applyNoStoreUnlessExplicitCache(res, fromArgs);
    return (originalWriteHead as (code: number, ...rest: unknown[]) => ServerResponse)(
      statusCode,
      ...args,
    );
  } as typeof res.writeHead;

  res.end = function (...args: unknown[]) {
    applyNoStoreUnlessExplicitCache(res);
    return (originalEnd as (...rest: unknown[]) => ServerResponse)(...args);
  } as typeof res.end;

  res.once("finish", restore);
  res.once("close", restore);
}

export function createRequestUrl(req: IncomingMessage, fallbackPort: number): URL {
  const host = req.headers.host ?? `127.0.0.1:${fallbackPort}`;
  return new URL(req.url ?? "/", `http://${host}`);
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload, "utf8"),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

export function parseBooleanQuery(value: string | null | undefined): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value === "true";
}
