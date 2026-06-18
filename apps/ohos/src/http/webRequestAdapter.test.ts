import { describe, it, expect } from "vitest"
import { Readable } from "node:stream"
import {
  MAX_BODY_BYTES,
  nodeRequestToWebRequest,
  writeWebResponse,
} from "./webRequestAdapter"
import type { IncomingMessage, ServerResponse } from "node:http"
import { EventEmitter } from "node:events"

function createMockRequest(
  options: {
    method?: string
    url?: string
    headers?: Record<string, string | string[] | undefined>
    body?: Buffer | string
  } = {},
): IncomingMessage {
  const req = new Readable({
    read() {
      // no-op; we push manually below
    },
  }) as IncomingMessage
  req.method = options.method ?? "GET"
  req.url = options.url ?? "/"
  req.headers = options.headers ?? {}
  if (options.body !== undefined) {
    const buf =
      typeof options.body === "string"
        ? Buffer.from(options.body, "utf-8")
        : options.body
    req.push(buf)
  }
  req.push(null)
  return req
}

class MockResponse extends EventEmitter {
  statusCode = 0
  headers: Record<string, string> = {}
  chunks: Buffer[] = []
  ended = false
  headersSent = false
  writeHead(status: number, headers: Record<string, string>) {
    this.statusCode = status
    this.headers = headers
    this.headersSent = true
  }
  write(chunk: Buffer | string) {
    this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    return true
  }
  end() {
    this.ended = true
    this.emit("finish")
  }
}

describe("nodeRequestToWebRequest", () => {
  it("converts a GET request to a Web Request with the right method and URL", async () => {
    const req = createMockRequest({ method: "GET", url: "/mcp/" })
    const web = await nodeRequestToWebRequest(req, "http://127.0.0.1:18081")
    expect(web.method).toBe("GET")
    expect(web.url).toBe("http://127.0.0.1:18081/mcp/")
  })

  it("copies request headers (single values)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/mcp/",
      headers: { "content-type": "application/json", accept: "*/*" },
      body: "{}",
    })
    const web = await nodeRequestToWebRequest(req, "http://localhost")
    expect(web.headers.get("content-type")).toBe("application/json")
    expect(web.headers.get("accept")).toBe("*/*")
  })

  it("joins repeated headers into comma-separated values", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/mcp/",
      headers: { "x-multi": ["a", "b"] },
      body: "",
    })
    const web = await nodeRequestToWebRequest(req, "http://localhost")
    expect(web.headers.get("x-multi")).toBe("a, b")
  })

  it("attaches a Buffer body for non-GET/HEAD methods", async () => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1 })
    const req = createMockRequest({
      method: "POST",
      url: "/mcp/",
      headers: { "content-type": "application/json" },
      body,
    })
    const web = await nodeRequestToWebRequest(req, "http://localhost")
    expect(await web.text()).toBe(body)
  })

  it("does not attach a body for GET/HEAD methods", async () => {
    const req = createMockRequest({ method: "GET", url: "/mcp/" })
    const web = await nodeRequestToWebRequest(req, "http://localhost")
    expect(web.body).toBeNull()
  })

  it("rejects oversized bodies", async () => {
    const huge = Buffer.alloc(MAX_BODY_BYTES + 1, "x")
    const req = createMockRequest({
      method: "POST",
      url: "/mcp/",
      body: huge,
    })
    await expect(
      nodeRequestToWebRequest(req, "http://localhost"),
    ).rejects.toThrow(/maximum size/)
  })
})

describe("writeWebResponse", () => {
  it("writes status, headers, and body to a node:http response", async () => {
    const res = new MockResponse() as unknown as ServerResponse
    const response = new Response("hello", {
      status: 201,
      headers: { "x-test": "value", "content-type": "text/plain" },
    })
    await writeWebResponse(res, response)
    expect(res.statusCode).toBe(201)
    expect(res.headers["x-test"]).toBe("value")
    expect(Buffer.concat(res.chunks).toString("utf-8")).toBe("hello")
    expect(res.ended).toBe(true)
  })

  it("handles responses with no body", async () => {
    const res = new MockResponse() as unknown as ServerResponse
    const response = new Response(null, { status: 204 })
    await writeWebResponse(res, response)
    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
  })
})
