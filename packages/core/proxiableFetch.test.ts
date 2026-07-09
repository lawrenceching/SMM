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
    expect(init.headers).toEqual({ A: "1" })
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
        fetchFn: fetchFn as unknown as typeof fetch,
      },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls[0]![0] as unknown).toBe("http://a/v1/ping")
    expect(fetchFn.mock.calls[1]![0] as unknown).toBe("http://b/v1/ping")
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

describe("proxiableFetch — HTTP error handling", () => {
  it("fails over when the response is !ok and abortOnHttpError is true (default)", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => mockResponse({ ok: false, status: 500, statusText: "Boom" }),
      async () => mockResponse({ ok: true, status: 200 }),
    ]
    const fetchFn = vi.fn(async () => responses.shift()!())
    const resp = await proxiableFetch(
      { path: "/v1/ping", urls: ["http://a", "http://b"], fetchFn },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it("returns the failing response when abortOnHttpError is false", async () => {
    const fetchFn = vi.fn(
      async () => mockResponse({ ok: false, status: 500, statusText: "Boom" }),
    )
    const resp = await proxiableFetch(
      {
        path: "/v1/ping",
        urls: ["http://a", "http://b"],
        abortOnHttpError: false,
        fetchFn,
      },
      {},
    )
    expect(resp.status).toBe(500)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("does not read the body of a failing response (no leak on the failing path)", async () => {
    const bodyAccess = vi.fn()
    const failing: Response = {
      ok: false,
      status: 500,
      statusText: "Boom",
      body: {
        getReader: () => {
          bodyAccess()
          return {} as ReadableStreamDefaultReader<Uint8Array>
        },
      },
    } as unknown as Response
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(failing)
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn: fetchFn as unknown as typeof fetch },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(bodyAccess).not.toHaveBeenCalled()
  })
})

describe("proxiableFetch — reverse-proxy iteration", () => {
  it("iterates direct then each proxy for the first URL, then advances to the next URL", async () => {
    const calls: Array<{ url: string; proxy: string | undefined }> = []
    const beforeFetch = vi.fn(
      (input: { url: string; proxy: string | undefined }) => {
        calls.push({ url: input.url, proxy: input.proxy })
        return
      },
    )
    // All 9 attempts fail so we observe the full iteration order.
    const fetchFn = vi.fn(async () => {
      throw new TypeError("all fail")
    })
    await expect(
      proxiableFetch(
        {
          path: "/v1/ping",
          urls: ["http://cn", "http://hk", "http://uk"],
          reverseProxies: ["http://p1", "http://p2"],
          fetchFn,
          beforeFetch,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(TypeError)
    // 3 URLs × (1 direct + 2 proxies) = 9 attempts, all called.
    expect(fetchFn).toHaveBeenCalledTimes(9)
    expect(calls.map((c) => c.url)).toEqual([
      "http://cn/v1/ping",
      "http://p1/v1/ping",
      "http://p2/v1/ping",
      "http://hk/v1/ping",
      "http://p1/v1/ping",
      "http://p2/v1/ping",
      "http://uk/v1/ping",
      "http://p1/v1/ping",
      "http://p2/v1/ping",
    ])
    // First 3 calls: target cn, then p1 wraps cn, then p2 wraps cn.
    expect(calls[0]!.proxy).toBeUndefined()
    expect(calls[1]!.proxy).toBe("http://p1")
    expect(calls[2]!.proxy).toBe("http://p2")
  })

  it("succeeds via the first proxy when the direct attempt throws", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => {
        throw new TypeError("direct down")
      },
      async () => mockResponse({ ok: true }),
    ]
    const fetchFn = vi.fn(async () => responses.shift()!())
    const proxyArgs: Array<string | undefined> = []
    const resp = await proxiableFetch(
      {
        path: "/x",
        urls: ["http://cn"],
        reverseProxies: ["http://p1"],
        fetchFn,
        beforeFetch: (i) => {
          proxyArgs.push(i.proxy)
        },
      },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(proxyArgs).toEqual([undefined, "http://p1"])
  })

  it("treats reverseProxies = undefined as [] (no proxy attempts)", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a", "http://b"],
        // no reverseProxies
        fetchFn,
      },
      {},
    )
    expect(fetchFn).toHaveBeenCalledTimes(1) // first call returns ok
  })
})

describe("proxiableFetch — beforeFetch", () => {
  it("leaves headers unchanged when beforeFetch returns void", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn,
        beforeFetch: () => undefined,
      },
      { headers: { A: "1" } },
    )
    const initArg = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(initArg.headers).toEqual({ A: "1" })
  })

  it("merges beforeFetch headers into a plain-object init.headers", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn,
        beforeFetch: () => ({ "X-Proxy-Auth": "Bearer t" }),
      },
      { headers: { A: "1" } },
    )
    const initArg = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(initArg.headers).toEqual({ A: "1", "X-Proxy-Auth": "Bearer t" })
  })

  it("merges beforeFetch headers into a Headers instance", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn: fetchFn as unknown as typeof fetch,
        beforeFetch: () => ({ "X-Proxy-Auth": "Bearer t" }),
      },
      { headers: new Headers({ A: "1" }) },
    )
    const initArg = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    const h = initArg.headers as Headers
    expect(h.get("A")).toBe("1")
    expect(h.get("X-Proxy-Auth")).toBe("Bearer t")
  })

  it("init.headers wins on key collision (caller's headers take precedence)", async () => {
    const fetchFn = vi.fn(async (_u: string, _i?: RequestInit) => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn: fetchFn as unknown as typeof fetch,
        beforeFetch: () => ({ A: "from-beforeFetch" }),
      },
      { headers: { A: "from-init" } },
    )
    const initArg = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
    const h = initArg.headers as Record<string, string>
    // The spec's documented ordering: init.headers wins on collision.
    expect(h.A).toBe("from-init")
  })
})

describe("proxiableFetch — AbortSignal", () => {
  it("throws immediately when the signal is already aborted before any call", async () => {
    const ac = new AbortController()
    ac.abort()
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a", "http://b"], fetchFn },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("rethrows an AbortError from fetchFn and does not continue to the next attempt", async () => {
    const ac = new AbortController()
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(async () => {
        ac.abort()
        throw new DOMException("aborted", "AbortError")
      })
      .mockResolvedValue(mockResponse({ ok: true }))
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a", "http://b"], fetchFn: fetchFn as unknown as typeof fetch },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("honors signal.reason over the default AbortError", async () => {
    const ac = new AbortController()
    ac.abort(new Error("custom-reason"))
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    let caught: unknown
    try {
      await proxiableFetch(
        { path: "/x", urls: ["http://a"], fetchFn },
        { signal: ac.signal },
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe("custom-reason")
  })
})

describe("proxiableFetch — body cloning across attempts", () => {
  it("clones a URLSearchParams body so each attempt has its own", async () => {
    const initBody = new URLSearchParams("a=1")
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn: fetchFn as unknown as typeof fetch },
      { method: "POST", body: initBody },
    )
    expect(resp.ok).toBe(true)
    const call1 = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams
    const call2 = (fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body as URLSearchParams
    expect(call1).toBeInstanceOf(URLSearchParams)
    expect(call2).toBeInstanceOf(URLSearchParams)
    expect(call1).not.toBe(call2)
    expect(call1.get("a")).toBe("1")
    expect(call2.get("a")).toBe("1")
  })

  it("clones a Blob body so each attempt has its own Blob with the same bytes", async () => {
    const initBody = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/octet-stream",
    })
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn: fetchFn as unknown as typeof fetch },
      { method: "POST", body: initBody },
    )
    expect(resp.ok).toBe(true)
    const call1 = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as Blob
    const call2 = (fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body as Blob
    expect(call1).toBeInstanceOf(Blob)
    expect(call2).toBeInstanceOf(Blob)
    expect(call1).not.toBe(call2)
    expect(await call1.text()).toBe(await call2.text())
  })
})

describe("proxiableFetch — edge cases", () => {
  it("throws when neither fetchFn nor globalThis.fetch is available", async () => {
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    delete (globalThis as { fetch?: typeof fetch }).fetch
    try {
      const fetchFn = undefined as unknown as typeof fetch
      await expect(
        proxiableFetch({ path: "/x", urls: ["http://a"], fetchFn }),
      ).rejects.toThrow(/no fetch implementation available/)
    } finally {
      if (original) (globalThis as { fetch?: typeof fetch }).fetch = original
    }
  })

  it("falls back to globalThis.fetch when fetchFn is omitted", async () => {
    const stubFetch = vi.fn(async () => mockResponse({ ok: true }))
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    ;(globalThis as { fetch?: typeof fetch }).fetch = stubFetch as unknown as typeof fetch
    try {
      const resp = await proxiableFetch({ path: "/x", urls: ["http://a"] })
      expect(resp.ok).toBe(true)
      expect(stubFetch).toHaveBeenCalledTimes(1)
      expect(stubFetch).toHaveBeenCalledWith("http://a/x", expect.any(Object))
    } finally {
      if (original) {
        ;(globalThis as { fetch?: typeof fetch }).fetch = original
      } else {
        delete (globalThis as { fetch?: typeof fetch }).fetch
      }
    }
  })
})
