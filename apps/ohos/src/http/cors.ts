import type { IncomingMessage, ServerResponse } from "node:http"

/** Apply CORS headers on every response (Electron renderer may be cross-origin vs 127.0.0.1). */
export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  if (typeof origin === "string" && origin.length > 0) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*")
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
  const requestedHeaders = req.headers["access-control-request-headers"]
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof requestedHeaders === "string" && requestedHeaders.length > 0
      ? requestedHeaders
      : "Content-Type, Authorization, x-trace-id",
  )
  res.setHeader("Access-Control-Max-Age", "86400")
}
