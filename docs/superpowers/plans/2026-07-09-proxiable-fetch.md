# proxiableFetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single exported function `proxiableFetch` to `@smm/core` that walks an ordered (urls × reverseProxies) attempt sequence, with custom `fetchFn`, `beforeFetch` header hook, body cloning, and `AbortSignal` handling.

**Architecture:** One file `packages/core/proxiableFetch.ts` exports the function plus its types, with three small private helpers (`joinUrl`, `mergeHeaders`, `cloneRequestInit`) tested in isolation. The main function loops a precomputed attempt list (one direct + N proxies per URL), drives `fetchFn`, classifies each outcome (ok / HTTP error / thrown / AbortError), and either returns the response or stores the last error. Twenty test cases (matching the spec's testing strategy) drive the design.

**Tech Stack:** TypeScript (ESM, `verbatimModuleSyntax`), Vitest, `@smm/core` (no new dependencies).

**Working directory for all commands:** `C:\Users\lawrence\workspace\smm_github`

**Design refs:**
- `docs/superpowers/specs/2026-07-09-proxiable-fetch-design.md`

**Spec coverage check** (every spec section maps to a task):
- Public API types → Task 2
- Algorithm (attempt loop, classify) → Tasks 3-5
- URL composition (joinUrl) → Task 1
- Error handling table → Tasks 3, 4, 5, 6, 8
- Body cloning (cloneRequestInit) → Task 9
- All 20 test cases → Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Verification → Task 11

---

## File Map

**Create:**
- `packages/core/proxiableFetch.ts` — public types and function; private helpers `joinUrl`, `mergeHeaders`, `cloneRequestInit`.
- `packages/core/proxiableFetch.test.ts` — vitest tests covering the 20 spec cases plus helper tests.

**Modify:** none.

**Untouched (out of scope):**
- `apps/ui/src/lib/proxyRequestHeaders.ts` and other UI callers — no consumer migrates in this change.
- `packages/core-routes` and `apps/cli` — they don't need a fetch client.

---

## Pre-flight: confirm baseline is green

- [ ] **Step 1: Run baseline tests for `packages/core`**

Run:

```bash
pnpm -C packages/core test
```

Expected: all tests pass. Note the count for regression comparison.

- [ ] **Step 2: Run typecheck baseline**

```bash
pnpm -C packages/core typecheck
```

Expected: clean exit.

---

## Task 1: Pure helpers — `joinUrl`, `mergeHeaders`, `cloneRequestInit`

**Files:**
- Create: `packages/core/proxiableFetch.ts`
- Create: `packages/core/proxiableFetch.test.ts`

These three helpers are pure functions, easy to test in isolation, and the rest of the implementation will compose them.

- [ ] **Step 1: Write failing tests for `joinUrl`**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
```

The `_` prefix marks these as test-only exports. The public `proxiableFetch.ts` will still export them so tests can reach them; they're not in any documentation / index. (If we later want to hide them, we move tests to a private path.)

- [ ] **Step 2: Run the tests; verify they fail**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: FAIL — `_joinUrl is not a function` (the file does not exist yet).

- [ ] **Step 3: Implement the helpers in `proxiableFetch.ts`**

Create `packages/core/proxiableFetch.ts` with this exact content:

```ts
export function _joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return cleanBase + cleanPath
}

export function _mergeHeaders(
  init: RequestInit,
  extra: Record<string, string> | void,
): void {
  if (!extra) return
  const incoming = init.headers
  if (incoming instanceof Headers) {
    for (const [k, v] of Object.entries(extra)) incoming.set(k, v)
    return
  }
  // init.headers is undefined | Record<string,string> | string[][]. We only
  // support the object form for the merge path; the spec forbids the rest here.
  const obj: Record<string, string> = (incoming as Record<string, string> | undefined) ?? {}
  for (const [k, v] of Object.entries(extra)) obj[k] = v
  init.headers = obj
}

export function _cloneRequestInit(init: RequestInit): RequestInit {
  const out: RequestInit = {
    method: init.method,
    credentials: init.credentials,
    mode: init.mode,
    cache: init.cache,
    redirect: init.redirect,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive,
    signal: init.signal,
    window: init.window,
  }
  if (init.headers === undefined) {
    out.headers = undefined
  } else if (init.headers instanceof Headers) {
    out.headers = new Headers(init.headers)
  } else if (Array.isArray(init.headers)) {
    // array form: deep-copy the tuples
    out.headers = init.headers.map(([k, v]) => [k, v] as [string, string])
  } else {
    out.headers = { ...init.headers }
  }
  if (init.body === undefined || init.body === null) {
    out.body = undefined
  } else if (typeof init.body === "string") {
    out.body = init.body
  } else if (init.body instanceof URLSearchParams) {
    out.body = new URLSearchParams(init.body.toString())
  } else if (init.body instanceof FormData) {
    const fd = new FormData()
    init.body.forEach((value, key) => {
      fd.append(key, value)
    })
    out.body = fd
  } else if (init.body instanceof Blob) {
    out.body = new Blob([init.body], { type: init.body.type })
  } else if (init.body instanceof ArrayBuffer) {
    const copy = new ArrayBuffer(init.body.byteLength)
    new Uint8Array(copy).set(new Uint8Array(init.body))
    out.body = copy
  } else if (ArrayBuffer.isView(init.body)) {
    const view = init.body as ArrayBufferView
    const copy = new ArrayBuffer(view.byteLength)
    new Uint8Array(copy).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    // Re-wrap in a view of the same constructor (preserves typed-array type).
    const Ctor = (view.constructor as unknown) as new (
      buf: ArrayBuffer,
      byteOffset?: number,
      length?: number,
    ) => ArrayBufferView
    out.body = new Ctor(copy, 0, view.byteLength / (Ctor.BYTES_PER_ELEMENT ?? 1))
  } else {
    // Anything else (ReadableStream, etc.) — pass through. Documented limitation
    // in the spec: subsequent attempts will fail at fetchFn with a stream-lock
    // error, which the catch path records as a normal failure.
    out.body = init.body
  }
  return out
}
```

- [ ] **Step 4: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for all 5 `joinUrl` cases.

- [ ] **Step 5: Add tests for `_mergeHeaders` and run**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
```

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for the 5 new cases (10 total).

- [ ] **Step 6: Add tests for `_cloneRequestInit` and run**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
```

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for the 11 new cases (21 total).

- [ ] **Step 7: Typecheck**

```bash
pnpm -C packages/core typecheck
```

Expected: clean exit.

- [ ] **Step 8: Commit**

```bash
git add packages/core/proxiableFetch.ts packages/core/proxiableFetch.test.ts
git commit -m "feat(core): add proxiableFetch URL/header/body helpers"
```

---

## Task 2: `proxiableFetch` types + happy path (case 1)

**Files:**
- Modify: `packages/core/proxiableFetch.ts`
- Modify: `packages/core/proxiableFetch.test.ts`

This task defines the public types and the function signature, then implements just enough for the first direct URL to succeed.

- [ ] **Step 1: Add failing test — first direct URL returns the response**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
import { proxiableFetch, type ProxiableFetchOptions } from "./proxiableFetch"
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
```

- [ ] **Step 2: Run the tests; verify they fail**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: FAIL — `proxiableFetch is not a function` (or, if compile fails, fix compile first).

- [ ] **Step 3: Implement types and a minimal function**

Replace the contents of `packages/core/proxiableFetch.ts` with the following (helpers from Task 1 stay at the top; the new types and function go below):

```ts
export function _joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return cleanBase + cleanPath
}

export function _mergeHeaders(
  init: RequestInit,
  extra: Record<string, string> | void,
): void {
  if (!extra) return
  const incoming = init.headers
  if (incoming instanceof Headers) {
    for (const [k, v] of Object.entries(extra)) incoming.set(k, v)
    return
  }
  const obj: Record<string, string> = (incoming as Record<string, string> | undefined) ?? {}
  for (const [k, v] of Object.entries(extra)) obj[k] = v
  init.headers = obj
}

export function _cloneRequestInit(init: RequestInit): RequestInit {
  // ... (full implementation from Task 1, unchanged)
  const out: RequestInit = {
    method: init.method,
    credentials: init.credentials,
    mode: init.mode,
    cache: init.cache,
    redirect: init.redirect,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive,
    signal: init.signal,
    window: init.window,
  }
  if (init.headers === undefined) {
    out.headers = undefined
  } else if (init.headers instanceof Headers) {
    out.headers = new Headers(init.headers)
  } else if (Array.isArray(init.headers)) {
    out.headers = init.headers.map(([k, v]) => [k, v] as [string, string])
  } else {
    out.headers = { ...init.headers }
  }
  if (init.body === undefined || init.body === null) {
    out.body = undefined
  } else if (typeof init.body === "string") {
    out.body = init.body
  } else if (init.body instanceof URLSearchParams) {
    out.body = new URLSearchParams(init.body.toString())
  } else if (init.body instanceof FormData) {
    const fd = new FormData()
    init.body.forEach((value, key) => {
      fd.append(key, value)
    })
    out.body = fd
  } else if (init.body instanceof Blob) {
    out.body = new Blob([init.body], { type: init.body.type })
  } else if (init.body instanceof ArrayBuffer) {
    const copy = new ArrayBuffer(init.body.byteLength)
    new Uint8Array(copy).set(new Uint8Array(init.body))
    out.body = copy
  } else if (ArrayBuffer.isView(init.body)) {
    const view = init.body as ArrayBufferView
    const copy = new ArrayBuffer(view.byteLength)
    new Uint8Array(copy).set(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
    )
    const Ctor = (view.constructor as unknown) as new (
      buf: ArrayBuffer,
      byteOffset?: number,
      length?: number,
    ) => ArrayBufferView
    out.body = new Ctor(copy, 0, view.byteLength / (Ctor.BYTES_PER_ELEMENT ?? 1))
  } else {
    out.body = init.body
  }
  return out
}

export interface ProxiableFetchContext {
  attemptIndex: number
  urlIndex: number
  proxyIndex: number | null
  totalAttempts: number
  path: string
  targetUrl: string
}

export type ProxiableFetchBeforeFetch = (input: {
  url: string
  proxy: string | undefined
  context: ProxiableFetchContext
}) => Record<string, string> | void

export interface ProxiableFetchOptions {
  path: string
  urls: string[]
  reverseProxies?: string[]
  abortOnHttpError?: boolean
  fetchFn?: typeof fetch
  beforeFetch?: ProxiableFetchBeforeFetch
}

export async function proxiableFetch(
  options: ProxiableFetchOptions,
  init: RequestInit = {},
): Promise<Response> {
  if (options.urls.length === 0) {
    throw new Error("proxiableFetch: urls is empty")
  }
  const fetchFn = options.fetchFn ?? (globalThis.fetch as typeof fetch | undefined)
  if (!fetchFn) {
    throw new Error(
      "proxiableFetch: no fetch implementation available; pass `fetchFn`",
    )
  }
  const reverseProxies = options.reverseProxies ?? []
  const totalAttempts = options.urls.length * (1 + reverseProxies.length)
  let attemptIndex = 0
  let lastError: unknown

  for (let urlIndex = 0; urlIndex < options.urls.length; urlIndex++) {
    const targetUrl = options.urls[urlIndex]!
    const attemptUrls: Array<{ callUrl: string; proxyIndex: number | null }> = [
      { callUrl: targetUrl, proxyIndex: null },
      ...reverseProxies.map((p, i) => ({ callUrl: p, proxyIndex: i })),
    ]

    for (const { callUrl, proxyIndex } of attemptUrls) {
      if (init.signal?.aborted) {
        throw init.signal.reason ?? new DOMException("aborted", "AbortError")
      }
      const perAttemptInit = _cloneRequestInit(init)
      const fullCallUrl = _joinUrl(callUrl, options.path)
      if (options.beforeFetch) {
        const extra = options.beforeFetch({
          url: fullCallUrl,
          proxy: proxyIndex === null ? undefined : reverseProxies[proxyIndex],
          context: {
            attemptIndex,
            urlIndex,
            proxyIndex,
            totalAttempts,
            path: options.path,
            targetUrl,
          },
        })
        _mergeHeaders(perAttemptInit, extra)
      } else {
        perAttemptInit.headers = _cloneRequestInit({ headers: perAttemptInit.headers }).headers
      }

      let response: Response
      try {
        response = await fetchFn(fullCallUrl, perAttemptInit)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err
        if (err instanceof Error && err.name === "AbortError") throw err
        lastError = err
        attemptIndex++
        continue
      }

      if (response.ok) return response

      if (options.abortOnHttpError === false) return response

      lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
      attemptIndex++
    }
  }

  throw lastError ?? new Error("proxiableFetch: no attempts made")
}
```

Note: the `else { perAttemptInit.headers = ... }` line in the `beforeFetch` branch is a no-op kept only to keep the diff small for now. It's a dead branch (else of `if (options.beforeFetch)`) and will be removed in a later task.

- [ ] **Step 4: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for the 21 helper cases + 2 new cases (23 total). The `urls is empty` case should pass because we throw before calling fetchFn.

- [ ] **Step 5: Typecheck**

```bash
pnpm -C packages/core typecheck
```

Expected: clean exit. (If `lastError ?? new Error("...")` is flagged as unreachable with strict checks, narrow the guard — see Note in Step 6.)

- [ ] **Step 6: Remove the dead `else` branch**

Replace this block in `packages/core/proxiableFetch.ts`:

```ts
      if (options.beforeFetch) {
        const extra = options.beforeFetch({
          url: fullCallUrl,
          proxy: proxyIndex === null ? undefined : reverseProxies[proxyIndex],
          context: {
            attemptIndex,
            urlIndex,
            proxyIndex,
            totalAttempts,
            path: options.path,
            targetUrl,
          },
        })
        _mergeHeaders(perAttemptInit, extra)
      } else {
        perAttemptInit.headers = _cloneRequestInit({ headers: perAttemptInit.headers }).headers
      }
```

with:

```ts
      if (options.beforeFetch) {
        const extra = options.beforeFetch({
          url: fullCallUrl,
          proxy: proxyIndex === null ? undefined : reverseProxies[proxyIndex],
          context: {
            attemptIndex,
            urlIndex,
            proxyIndex,
            totalAttempts,
            path: options.path,
            targetUrl,
          },
        })
        _mergeHeaders(perAttemptInit, extra)
      }
```

- [ ] **Step 7: Re-run tests + typecheck**

```bash
pnpm -C packages/core test proxiableFetch && pnpm -C packages/core typecheck
```

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core/proxiableFetch.ts packages/core/proxiableFetch.test.ts
git commit -m "feat(core): proxiableFetch skeleton + happy path"
```

---

## Task 3: Network-throw failover (cases 2, 7) + all-fail throws last

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

This task exercises the catch branch: when `fetchFn` throws, we record and continue. After exhausting all attempts we throw the **last** recorded error.

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for both new cases. (Implementation from Task 2 already records throws and rethrows the last one.)

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch failover on network throw"
```

---

## Task 4: HTTP-error failover (case 6) + `abortOnHttpError: false` (case 5)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
      .fn<[string, RequestInit?], Promise<Response>>()
      .mockResolvedValueOnce(failing)
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn },
      {},
    )
    expect(resp.ok).toBe(true)
    expect(bodyAccess).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for all 3 new cases. The implementation already handles these — `bodyAccess` not being called confirms we never touch the failing response body.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch HTTP error failover and abortOnHttpError:false"
```

---

## Task 5: Reverse-proxy iteration — full 9-attempt sequence (cases 3, 4, 15)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

The implementation from Task 2 already iterates `reverseProxies` after each `targetUrl`. This task verifies the order with concrete test cases.

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
describe("proxiableFetch — reverse-proxy iteration", () => {
  it("iterates direct then each proxy for the first URL, then advances to the next URL", async () => {
    const calls: Array<{ url: string; proxy: string | undefined }> = []
    const beforeFetch = vi.fn(
      (input: { url: string; proxy: string | undefined }) => {
        calls.push({ url: input.url, proxy: input.proxy })
        return
      },
    )
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/v1/ping",
        urls: ["http://cn", "http://hk", "http://uk"],
        reverseProxies: ["http://p1", "http://p2"],
        fetchFn,
        beforeFetch,
      },
      {},
    )
    // 3 URLs × (1 direct + 2 proxies) = 9 attempts.
    expect(fetchFn).toHaveBeenCalledTimes(1) // first call returns ok
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
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for all 3 new cases.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch reverse-proxy iteration order"
```

---

## Task 6: `beforeFetch` integration and header merging (cases 8, 9, 10, 20)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
    const initArg = fetchFn.mock.calls[0]![1] as RequestInit
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
    const initArg = fetchFn.mock.calls[0]![1] as RequestInit
    expect(initArg.headers).toEqual({ A: "1", "X-Proxy-Auth": "Bearer t" })
  })

  it("merges beforeFetch headers into a Headers instance", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn,
        beforeFetch: () => ({ "X-Proxy-Auth": "Bearer t" }),
      },
      { headers: new Headers({ A: "1" }) },
    )
    const initArg = fetchFn.mock.calls[0]![1] as RequestInit
    const h = initArg.headers as Headers
    expect(h.get("A")).toBe("1")
    expect(h.get("X-Proxy-Auth")).toBe("Bearer t")
  })

  it("init.headers wins on key collision (caller's headers take precedence)", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await proxiableFetch(
      {
        path: "/x",
        urls: ["http://a"],
        fetchFn,
        beforeFetch: () => ({ A: "from-beforeFetch" }),
      },
      { headers: { A: "from-init" } },
    )
    const initArg = fetchFn.mock.calls[0]![1] as RequestInit
    const h = initArg.headers as Record<string, string>
    // Note: in plain-object merge we DO overwrite with beforeFetch, but the
    // spec's documented ordering is "init.headers wins on collision".
    // To honor that, the implementation must read init.headers first, then
    // spread beforeFetch on top is wrong. This test pins the behavior we want.
    expect(h.A).toBe("from-init")
  })
})
```

- [ ] **Step 2: Run the tests; the "init wins" case may fail — inspect**

```bash
pnpm -C packages/core test proxiableFetch
```

If the collision test fails because the implementation overwrites `A` with `from-beforeFetch`, we need to fix the merge order.

- [ ] **Step 3: Fix `_mergeHeaders` to make `init.headers` win on collision**

In `packages/core/proxiableFetch.ts`, change `_mergeHeaders` so that when `init.headers` is a plain object, we re-order the merge: first copy init into a new object, then spread `extra` on top **but for any key present in `init`, keep init's value**. The cleanest approach: do the merge with init as the base, then for each key in `extra` only set it if it's NOT already present in `init.headers`. (This matches the test's expectation that the caller's value wins.)

Replace `_mergeHeaders` with:

```ts
export function _mergeHeaders(
  init: RequestInit,
  extra: Record<string, string> | void,
): void {
  if (!extra) return
  const incoming = init.headers
  if (incoming instanceof Headers) {
    for (const [k, v] of Object.entries(extra)) {
      if (!incoming.has(k)) incoming.set(k, v)
    }
    return
  }
  const obj: Record<string, string> = (incoming as Record<string, string> | undefined) ?? {}
  for (const [k, v] of Object.entries(extra)) {
    if (!(k in obj)) obj[k] = v
  }
  init.headers = obj
}
```

- [ ] **Step 4: Re-run the tests; verify all pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for all 4 new cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/proxiableFetch.ts packages/core/proxiableFetch.test.ts
git commit -m "feat(core): proxiableFetch beforeFetch header merge (init wins on collision)"
```

---

## Task 7: `AbortSignal` handling (cases 11, 12)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

The implementation already throws when `init.signal?.aborted` is true at the start of an attempt, and re-throws `AbortError` from `fetchFn` without recording. This task pins the behavior.

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
      .fn<[string, RequestInit?], Promise<Response>>()
      .mockImplementationOnce(async () => {
        ac.abort()
        throw new DOMException("aborted", "AbortError")
      })
      .mockResolvedValue(mockResponse({ ok: true })) // would be called next if we continued
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a", "http://b"], fetchFn },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("honors signal.reason over the default AbortError", async () => {
    const ac = new AbortController()
    ac.abort(new Error("custom-reason"))
    const fetchFn = vi.fn(async () => mockResponse({ ok: true }))
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a"], fetchFn },
        { signal: ac.signal },
      ),
    ).rejects.toBeInstanceOf(Error)
    // The thrown reason is a plain Error with that message, not a DOMException
    try {
      await proxiableFetch(
        { path: "/x", urls: ["http://a"], fetchFn },
        { signal: ac.signal },
      )
    } catch (e) {
      expect((e as Error).message).toBe("custom-reason")
    }
  })
})
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for all 3 new cases. If case 3 fails because the implementation always throws `DOMException` instead of `signal.reason`, fix the abort-throw line in the loop to use the OR-fallback we already wrote (`throw init.signal.reason ?? new DOMException(...)`) — that should be correct.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch AbortSignal handling"
```

---

## Task 8: Body cloning across attempts (cases 18, 19)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
describe("proxiableFetch — body cloning across attempts", () => {
  it("clones a URLSearchParams body so each attempt has its own", async () => {
    const initBody = new URLSearchParams("a=1")
    const fetchFn = vi
      .fn<[string, RequestInit?], Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn },
      { method: "POST", body: initBody },
    )
    expect(resp.ok).toBe(true)
    const call1 = fetchFn.mock.calls[0]![1]!.body as URLSearchParams
    const call2 = fetchFn.mock.calls[1]![1]!.body as URLSearchParams
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
      .fn<[string, RequestInit?], Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(mockResponse({ ok: true }))
    const resp = await proxiableFetch(
      { path: "/x", urls: ["http://a", "http://b"], fetchFn },
      { method: "POST", body: initBody },
    )
    expect(resp.ok).toBe(true)
    const call1 = fetchFn.mock.calls[0]![1]!.body as Blob
    const call2 = fetchFn.mock.calls[1]![1]!.body as Blob
    expect(call1).toBeInstanceOf(Blob)
    expect(call2).toBeInstanceOf(Blob)
    expect(call1).not.toBe(call2)
    expect(await call1.text()).toBe(await call2.text())
  })
})
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for both new cases. The `_cloneRequestInit` helper from Task 1 already handles these.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch body cloning across attempts"
```

---

## Task 9: Edge cases (cases 13, 14) + URL composition (cases 16, 17)

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS for both new cases. The implementation from Task 2 already handles these.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch edge cases (no fetchFn, default globalThis.fetch)"
```

---

## Task 10: Spec coverage gap — error message for HTTP failure on last attempt

**Files:**
- Modify: `packages/core/proxiableFetch.test.ts`

The spec says "After exhausting every attempt: throw the last error." When the last attempt fails with an HTTP error, the "last error" is the synthetic `Error('HTTP <status> <statusText>')` from the loop. This test pins that.

- [ ] **Step 1: Add failing test**

Append to `packages/core/proxiableFetch.test.ts`:

```ts
describe("proxiableFetch — final-error semantics", () => {
  it("throws the synthetic HTTP error from the last attempt when all attempts return HTTP errors", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => mockResponse({ ok: false, status: 502, statusText: "Bad Gateway" }),
      async () => mockResponse({ ok: false, status: 503, statusText: "Service Unavailable" }),
    ]
    const fetchFn = vi.fn(async () => responses.shift()!())
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a", "http://b"], fetchFn },
        {},
      ),
    ).rejects.toThrow(/HTTP 503 Service Unavailable/)
    // The first error (502) is NOT in the message.
    await expect(
      proxiableFetch(
        { path: "/x", urls: ["http://a", "http://b"], fetchFn },
        {},
      ),
    ).rejects.not.toThrow(/502/)
  })
})
```

- [ ] **Step 2: Run the tests; verify they pass**

```bash
pnpm -C packages/core test proxiableFetch
```

Expected: PASS. The implementation already produces the right message.

- [ ] **Step 3: Commit**

```bash
git add packages/core/proxiableFetch.test.ts
git commit -m "test(core): proxiableFetch final error message uses last attempt"
```

---

## Task 11: Final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-09-proxiable-fetch-design.md` (status banner only)

- [ ] **Step 1: Run the full test suite for `packages/core`**

```bash
pnpm -C packages/core test
```

Expected: all tests pass; the count includes the new `proxiableFetch.test.ts`. Compare to the baseline from Pre-flight; the new file's count is the delta.

- [ ] **Step 2: Run typecheck**

```bash
pnpm -C packages/core typecheck
```

Expected: clean exit.

- [ ] **Step 3: Verify no consumer was added in this change**

```bash
git -C C:/Users/lawrence/workspace/smm_github grep -n "proxiableFetch" packages apps
```

Expected: only `packages/core/proxiableFetch.ts`, `packages/core/proxiableFetch.test.ts`, and the spec/plan docs.

- [ ] **Step 4: Update the spec status banner**

Edit `docs/superpowers/specs/2026-07-09-proxiable-fetch-design.md`: change the `Status: Pending implementation` line to:

```
Status: Implemented 2026-07-09 (commits <fill-in-after-task-1..10>)
```

(The commits list is filled in after the next step — you can also say `commits <range>` once the commits exist; the user-facing point is "implemented".)

- [ ] **Step 5: Commit the spec status update**

```bash
git add docs/superpowers/specs/2026-07-09-proxiable-fetch-design.md
git commit -m "docs: mark proxiableFetch spec as implemented"
```

- [ ] **Step 6: Sanity-grep one more time**

```bash
git -C C:/Users/lawrence/workspace/smm_github grep -n "proxiableFetch" packages
```

Expected: only the source + test files.

---

## Self-Review

**1. Spec coverage:** every section of `docs/superpowers/specs/2026-07-09-proxiable-fetch-design.md` is implemented by a task:

- Public API (types, signature) → Task 2
- Algorithm (attempt loop, classify outcomes) → Tasks 2-5
- URL composition (joinUrl helper + 5 cases) → Task 1
- Error handling table — all 5 rows exercised by tests in Tasks 3, 4, 7, 9
- Body cloning (cloneRequestInit helper + URLSearchParams/Blob cases) → Tasks 1, 8
- All 20 spec test cases — Task 1 (5 joinUrl + 5 mergeHeaders + 11 cloneRequestInit helpers; not numbered against the 20), Task 2 (cases 1, 14), Task 3 (cases 2, 7), Task 4 (cases 5, 6, plus a body-not-touched guard), Task 5 (cases 3, 4, 15), Task 6 (cases 8, 9, 10, 20), Task 7 (cases 11, 12, plus a `signal.reason` extension), Task 8 (cases 18, 19), Task 9 (cases 13, 14 extension — the spec's "case 14" is the empty-urls check, which is in Task 2), Task 10 (extra coverage for the "throw last error" rule, which is implicitly case 7 but with HTTP-error last attempt).

- [x] Spec has a task for every requirement.

**2. Placeholder scan:** no TBD / TODO / "appropriate error handling" / "fill in details" remain. The only `fill-in` string is in Task 11 Step 4, which is the commit-list annotation the engineer fills in after running `git log`.

- [x] No placeholders.

**3. Type consistency:** `ProxiableFetchContext` is defined in Task 2 and used as-is in Tasks 2-10. `proxiableFetch` and the three helpers (`_joinUrl`, `_mergeHeaders`, `_cloneRequestInit`) are spelled identically throughout. `mockResponse` is defined once in Task 2 and reused in every subsequent test. The `urls is empty` error is referenced consistently.

- [x] No type drift between tasks.
