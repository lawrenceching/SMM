import { describe, expect, it, vi } from "vitest"
import {
  CLI_UI_READY_ACCEPT,
  formatProbeResult,
  isHtmlReadyResponse,
  probeCliHttp,
  probeCliUiReady,
} from "./cliReadyProbe"

describe("isHtmlReadyResponse", () => {
  it("accepts 200 text/html", () => {
    expect(isHtmlReadyResponse(200, "text/html; charset=utf-8")).toBe(true)
  })

  it("rejects 406 application/json", () => {
    expect(isHtmlReadyResponse(406, "application/json")).toBe(false)
  })

  it("rejects 200 without html content-type", () => {
    expect(isHtmlReadyResponse(200, "application/json")).toBe(false)
  })
})

describe("formatProbeResult", () => {
  it("includes Accept, status, content-type, and body snippet", () => {
    const line = formatProbeResult({
      url: "http://127.0.0.1:30021/",
      accept: CLI_UI_READY_ACCEPT,
      ok: false,
      status: 406,
      contentType: "application/json",
      bodySnippet: '{"error":"not acceptable"}',
      error: null,
      isHtmlReady: false,
    })
    expect(line).toContain("status=406")
    expect(line).toContain("application/json")
    expect(line).toContain("Accept=")
    expect(line).toContain("not acceptable")
  })
})

describe("probeCliHttp", () => {
  it("records Accept header and body from fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "not acceptable" }), {
        status: 406,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof fetch

    const result = await probeCliHttp(30021, "/", { fetchImpl })
    expect(result.status).toBe(406)
    expect(result.isHtmlReady).toBe(false)
    expect(result.bodySnippet).toContain("not acceptable")
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:30021/",
      expect.objectContaining({
        headers: { Accept: CLI_UI_READY_ACCEPT },
      }),
    )
  })
})

describe("probeCliUiReady", () => {
  it("tries /index.html when / is not HTML", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/index.html")) {
        return new Response("<!doctype html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      }
      return new Response("{}", {
        status: 406,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof fetch

    const { ready, probes } = await probeCliUiReady(30021, { fetchImpl })
    expect(ready).toBe(true)
    expect(probes).toHaveLength(2)
    expect(probes[1]?.isHtmlReady).toBe(true)
  })
})
