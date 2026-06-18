import type { IncomingMessage, ServerResponse } from "node:http"

/**
 * Convert a `node:http` `IncomingMessage` to a Web Standards
 * `Request`. Reads the request body from the underlying stream
 * (limited to {@link MAX_BODY_BYTES} so the adapter cannot be
 * abused to exhaust memory).
 *
 * Used by the OHOS main process to expose MCP (and any other
 * `Request`/`Response`-based handler) on its `node:http` server
 * without depending on Express/Hono.
 */
export const MAX_BODY_BYTES = 16 * 1024 * 1024 // 16 MiB

export async function nodeRequestToWebRequest(
  req: IncomingMessage,
  baseUrl: string,
): Promise<Request> {
  const url = req.url ?? "/"
  const method = req.method ?? "GET"
  const headers = new Headers()

  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v)
    } else {
      headers.set(name, value)
    }
  }

  let body: Buffer | undefined
  if (method !== "GET" && method !== "HEAD") {
    body = await readRequestBodyWithLimit(req, MAX_BODY_BYTES)
  }

  return new Request(`${baseUrl}${url}`, {
    method,
    headers,
    body: body as unknown as BodyInit,
    duplex: "half",
  } as RequestInit)
}

/**
 * Stream a Web Standards `Response` back through a
 * `node:http` `ServerResponse`. Handles status, headers, and the
 * response body (including streamed `ReadableStream` bodies, which
 * the MCP transport uses for SSE).
 */
export async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    // `set-cookie` may appear multiple times — preserve them all
    // rather than collapsing with the last-wins behaviour of a
    // plain object assignment.
    if (key.toLowerCase() === "set-cookie") {
      const existing = headers[key]
      headers[key] = existing ? `${existing}, ${value}` : value
    } else {
      headers[key] = value
    }
  })

  res.writeHead(response.status, headers)

  if (response.body === null) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        // Node 18+ accepts Uint8Array chunks directly.
        res.write(Buffer.from(value))
      }
    }
  } finally {
    reader.releaseLock()
  }
  res.end()
}

async function readRequestBodyWithLimit(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of req) {
    const buf = chunk as Buffer
    total += buf.length
    if (total > maxBytes) {
      // Drain to keep the socket healthy, then throw.
      req.resume()
      throw new Error(
        `Request body exceeds maximum size of ${maxBytes} bytes`,
      )
    }
    chunks.push(buf)
  }

  return Buffer.concat(chunks, total)
}
