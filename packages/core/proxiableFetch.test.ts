import { describe, expect, it } from "vitest"
import { _joinUrl, _mergeHeaders, _cloneRequestInit } from "./proxiableFetch"

describe("_joinUrl", () => {
  it("joins base and path with one slash", () => {
    expect(_joinUrl("http://x.com", "/y")).toBe("http://x.com/y")
  })
  it("strips trailing slash on base", () => {
    expect(_joinUrl("http://x.com/", "/y")).toBe("http://x.com/y")
  })
  it("prepends slash when path has none", () => {
    expect(_joinUrl("http://x.com", "y")).toBe("http://x.com/y")
  })
  it("preserves query string in path", () => {
    expect(_joinUrl("http://x.com", "/y?q=1")).toBe("http://x.com/y?q=1")
  })
  it("strips multiple trailing slashes on base", () => {
    expect(_joinUrl("http://x.com///", "/y")).toBe("http://x.com/y")
  })
})

describe("_mergeHeaders", () => {
  it("no-op when extra is void", () => {
    const init: RequestInit = { headers: { A: "1" } }
    _mergeHeaders(init, undefined)
    expect(init.headers).toEqual({ A: "1" })
  })
  it("merges into a plain object headers", () => {
    const init: RequestInit = { headers: { A: "1" } }
    _mergeHeaders(init, { B: "2" })
    expect(init.headers).toEqual({ A: "1", B: "2" })
  })
  it("incoming keys win on collision with a plain object", () => {
    const init: RequestInit = { headers: { A: "1" } }
    _mergeHeaders(init, { A: "2" })
    expect(init.headers).toEqual({ A: "2" })
  })
  it("merges into a Headers instance and mutates it", () => {
    const headers = new Headers({ A: "1" })
    const init: RequestInit = { headers }
    _mergeHeaders(init, { B: "2" })
    expect(headers.get("A")).toBe("1")
    expect(headers.get("B")).toBe("2")
  })
  it("creates a headers object when init.headers is undefined", () => {
    const init: RequestInit = {}
    _mergeHeaders(init, { A: "1" })
    expect(init.headers).toEqual({ A: "1" })
  })
})

describe("_cloneRequestInit", () => {
  it("returns a fresh init with no body and undefined headers when init is empty", () => {
    const out = _cloneRequestInit({})
    expect(out.body).toBeUndefined()
    expect(out.headers).toBeUndefined()
    expect(out).not.toBe({}) // returns a new object
  })

  it("shares the string body (immutable)", () => {
    const out = _cloneRequestInit({ body: "hello" })
    expect(out.body).toBe("hello")
  })

  it("clones URLSearchParams body so mutations do not leak", () => {
    const orig = new URLSearchParams("a=1")
    const out = _cloneRequestInit({ body: orig })
    expect(out.body).toBeInstanceOf(URLSearchParams)
    expect(out.body).not.toBe(orig)
    expect((out.body as URLSearchParams).get("a")).toBe("1")
  })

  it("clones FormData body so mutations do not leak", () => {
    const orig = new FormData()
    orig.append("k", "v")
    const out = _cloneRequestInit({ body: orig })
    expect(out.body).toBeInstanceOf(FormData)
    expect(out.body).not.toBe(orig)
    expect(Array.from((out.body as FormData).entries())).toEqual([["k", "v"]])
  })

  it("clones Blob body so the new attempt has its own Blob", () => {
    const orig = new Blob(["hi"], { type: "text/plain" })
    const out = _cloneRequestInit({ body: orig })
    expect(out.body).toBeInstanceOf(Blob)
    expect(out.body).not.toBe(orig)
  })

  it("clones an ArrayBuffer body", () => {
    const buf = new Uint8Array([1, 2, 3]).buffer
    const out = _cloneRequestInit({ body: buf })
    expect(out.body).toBeInstanceOf(ArrayBuffer)
    expect(out.body).not.toBe(buf)
    expect(new Uint8Array(out.body as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it("clones a Uint8Array (ArrayBufferView) body into a fresh buffer", () => {
    const orig = new Uint8Array([4, 5, 6])
    const out = _cloneRequestInit({ body: orig })
    expect(out.body).toBeInstanceOf(Uint8Array)
    expect(out.body).not.toBe(orig)
    expect(out.body).toEqual(new Uint8Array([4, 5, 6]))
  })

  it("clones Headers instance (mutations to the copy don't affect original)", () => {
    const orig = new Headers({ A: "1" })
    const out = _cloneRequestInit({ headers: orig })
    expect(out.headers).toBeInstanceOf(Headers)
    expect(out.headers).not.toBe(orig)
    ;(out.headers as Headers).set("A", "2")
    expect(orig.get("A")).toBe("1")
    expect((out.headers as Headers).get("A")).toBe("2")
  })

  it("clones an array-form headers", () => {
    const orig: [string, string][] = [["A", "1"]]
    const out = _cloneRequestInit({ headers: orig })
    expect(out.headers).toEqual(orig)
    expect(out.headers).not.toBe(orig)
  })

  it("preserves the signal reference (not cloned)", () => {
    const ac = new AbortController()
    const out = _cloneRequestInit({ signal: ac.signal })
    expect(out.signal).toBe(ac.signal)
  })
})

import { proxiableFetch } from "./proxiableFetch"
import { vi } from "vitest"

function mockResponse(opts: { ok: boolean; status?: number; statusText?: string }): Response {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? (opts.ok ? "OK" : "Internal Server Error"),
  } as unknown as Response
}

describe("proxiableFetch — happy path", () => {
  it("returns the response when the first direct URL returns ok", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      {
        path: "/v1/ping",
        urls: ["http://example.com.cn"],
        fetchFn,
      },
      { method: "GET" },
    )
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith(
      "http://example.com.cn/v1/ping",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("throws if urls is empty", async () => {
    const fetchFn = vi.fn()
    await expect(
      proxiableFetch({ path: "/v1/ping", urls: [], fetchFn }),
    ).rejects.toThrow(/urls is empty/)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe("proxiableFetch — failover on network throw", () => {
  it("fails over to the next URL when the first throws", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => {
        throw new TypeError("network down")
      },
      async () => mockResponse({ ok: true, status: 200 }),
    ]
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => {
      return responses.shift()!()
    })
    const resp = await proxiableFetch(
      {
        path: "/v1/ping",
        urls: ["http://a", "http://b"],
        fetchFn,
      },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls[0]![0]).toBe("http://a/v1/ping")
    expect(fetchFn.mock.calls[1]![0]).toBe("http://b/v1/ping")
  })

  it("throws the LAST error when every attempt fails", async () => {
    const errors = [
      new TypeError("first"),
      new TypeError("second"),
      new TypeError("third"),
    ]
    const fetchFn = vi.fn(async () => {
      throw errors.shift()!
    })
    await expect(
      proxiableFetch(
        {
          path: "/v1/ping",
          urls: ["http://a", "http://b", "http://c"],
          fetchFn,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(TypeError)
    // Three direct attempts, no proxies.
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })
})
