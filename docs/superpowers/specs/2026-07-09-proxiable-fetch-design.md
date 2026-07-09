# proxiableFetch Utility — Design

Date: 2026-07-09
Status: Pending implementation

## Problem

`apps/ui/src/lib/proxyRequestHeaders.ts` already builds `X-Upstream-Base-Url` / `X-SMM-Proxy-Upstream-BaseURL` headers for the OpenResty and SMM-local reverse-proxy protocols, and `apps/ui/src/api/tmdb.ts` already calls a single proxy URL per request. But callers (e.g. `MediaDatabaseSearchbox`, future TVDB / metadata paths) need a more general pattern: try a list of origin URLs in order, retrying each one through a list of reverse proxies before moving on. The Searchbox feature wired this up ad hoc; we want a reusable utility instead.

## Goal

Add a single exported function `proxiableFetch` to `@smm/core` that, given a list of `urls` and a list of `reverseProxies`, calls them in the order:

1. `url[0]` (direct)
2. `reverseProxies[0]` → `url[0]`
3. `reverseProxies[1]` → `url[0]`
4. `url[1]` (direct)
5. `reverseProxies[0]` → `url[1]`
6. `reverseProxies[1]` → `url[1]`
7. …continue until a non-failing response is returned, or the last attempt fails.

The function returns a `Response`. The first failing attempt is skipped; `AbortSignal` and request bodies are reused across attempts.

## Scope

- New file `packages/core/proxiableFetch.ts` containing the function and its types.
- New test file `packages/core/proxiableFetch.test.ts` (Vitest, matches existing `packages/core/*.test.ts` style).
- No consumers added in this change. (The existing Searchbox / tmdb path stays as-is; future tasks can migrate.)

## Non-Goals

- No retry-via-proxy for streamed request bodies (see [Body Cloning](#body-cloning)).
- No automatic timeout / backoff / rate limiting.
- No built-in header signing helpers (the existing `buildProxyRequestHeaders` in `apps/ui/src/lib/` is unchanged; consumers inject `X-Upstream-Base-Url` via `beforeFetch`).
- No migration of `tmdb.ts` or other consumers to this utility.
- No CLI-side use; this lives in `packages/core` for use by `apps/ui` (and any future client).

## Public API

```ts
// packages/core/proxiableFetch.ts

export interface ProxiableFetchContext {
  /** 0-based index of this attempt across the whole sequence. */
  attemptIndex: number
  /** Index in `options.urls` of the target this attempt is reaching. */
  urlIndex: number
  /** Index in `options.reverseProxies`, or null for the direct attempt. */
  proxyIndex: number | null
  /** Total number of attempts that will be made in this call. */
  totalAttempts: number
  /** Path provided by the caller (unchanged). */
  path: string
  /** The direct target URL for this attempt, without any proxy. */
  targetUrl: string
}

export type ProxiableFetchBeforeFetch = (input: {
  /** Actual URL that will be passed to `fetchFn`. */
  url: string
  /** Proxy URL when this attempt is proxied; `undefined` for the direct attempt. */
  proxy: string | undefined
  context: ProxiableFetchContext
}) => Record<string, string> | void

export interface ProxiableFetchOptions {
  path: string
  urls: string[]
  reverseProxies?: string[]      // default []
  abortOnHttpError?: boolean     // default true
  fetchFn?: typeof fetch         // default: globalThis.fetch
  beforeFetch?: ProxiableFetchBeforeFetch
}

export async function proxiableFetch(
  options: ProxiableFetchOptions,
  init: RequestInit = {},
): Promise<Response>
```

## Algorithm

```
let attemptIndex = 0
const totalAttempts = urls.length * (1 + (reverseProxies?.length ?? 0))
let lastError: unknown

for (urlIndex, targetUrl in urls) {
  // attemptUrls[0] is the direct attempt; the rest are proxy attempts.
  const attemptUrls: Array<{ callUrl: string; proxyIndex: number | null }> = [
    { callUrl: targetUrl, proxyIndex: null },
    ...(reverseProxies ?? []).map((p, i) => ({ callUrl: p, proxyIndex: i })),
  ]
  for (const { callUrl, proxyIndex } of attemptUrls) {
    if (init.signal?.aborted) throw init.signal.reason ?? new DOMException('aborted', 'AbortError')

    const perAttemptInit = cloneRequestInit(init)
    if (options.beforeFetch) {
      const extra = options.beforeFetch({
        url: callUrl,
        proxy: proxyIndex === null ? undefined : reverseProxies?.[proxyIndex],
        context: { attemptIndex, urlIndex, proxyIndex, totalAttempts, path, targetUrl },
      })
      if (extra) mergeHeaders(perAttemptInit, extra)
    }

    let response: Response
    try {
      response = await fetchFn(callUrl, perAttemptInit)
    } catch (err) {
      // AbortError propagation: if the consumer passed a signal and it was
      // aborted mid-flight, the fetchFn will typically throw a DOMException
      // named 'AbortError'. Re-throw it immediately; do NOT record-and-continue,
      // since the caller asked us to stop.
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (err instanceof Error && err.name === 'AbortError') throw err
      lastError = err
      attemptIndex++
      continue
    }

    if (response.ok) return response

    if (options.abortOnHttpError === false) {
      // Honour the caller's wish: any HTTP response is final.
      return response
    }

    // HTTP error and abortOnHttpError=true: failover.
    // Body is not consumed (no leak on the failing path).
    lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
    attemptIndex++
  }
}

throw lastError ?? new Error('proxiableFetch: no attempts made')
```

Notes:
- `proxyIndex` for the direct attempt is `null`, not `-1`, so the type matches the field.
- We intentionally do not read the failing response's body (would risk locking a body stream and leaking it). The status code is enough metadata for the final error.
- `cloneRequestInit` is the only body-shaping helper — see below.

## URL Composition

`joinUrl(base, path)`:
1. Strip trailing `/` from `base`.
2. Ensure `path` starts with `/` (prepend if missing). A path that already begins with `/` is left alone.
3. Return `base + path`.

Examples:
- `joinUrl('http://x.com', '/y')` → `'http://x.com/y'`
- `joinUrl('http://x.com/', '/y')` → `'http://x.com/y'`
- `joinUrl('http://x.com', 'y')` → `'http://x.com/y'`
- `joinUrl('http://x.com', '/y?q=1')` → `'http://x.com/y?q=1'`

## Error Handling

| Scenario | Behaviour |
|---|---|
| `fetchFn` throws (network, DNS) | Catch, store, continue with next attempt. |
| `fetchFn` throws an `AbortError` mid-flight | Re-throw immediately. Do not record-and-continue. |
| `init.signal.aborted === true` at the start of an attempt | Throw `signal.reason ?? DOMException('aborted', 'AbortError')` immediately; do not call `fetchFn`. |
| HTTP `>= 400` and `abortOnHttpError` is `true` (default) | Store `new Error('HTTP <status> <statusText>')`, continue. |
| HTTP any status and `abortOnHttpError` is `false` | Return that `Response`. Do not advance. |
| All attempts fail | Throw the **last** stored error. |
| `urls` is empty | Throw `Error('proxiableFetch: urls is empty')` immediately. |
| `fetchFn` not provided and `globalThis.fetch` is undefined | Throw `Error('proxiableFetch: no fetch implementation available; pass `fetchFn`')` immediately. |

The "throw the last error" choice keeps the error surface tiny. Operators can correlate with logs of the preceding attempts if needed.

## Body Cloning

`cloneRequestInit(init)` returns a fresh `RequestInit` with a re-created body so each attempt gets a usable body:

- `init.body === undefined` → `undefined`
- `string` → `string` (strings are immutable, return as-is)
- `URLSearchParams` → `new URLSearchParams(body.toString())`
- `FormData` → `new FormData()`, re-append each entry
- `Blob` → `new Blob([body], { type: body.type })`
- `ArrayBuffer` → copy into a new `ArrayBuffer` of the same byte length
- `ArrayBufferView` (typed arrays / `DataView`) → copy into a new buffer of the same byte length, wrap in a new view of the same constructor
- Anything else (e.g. a custom `ReadableStream`) → return the original `init` as-is. The first attempt consumes the stream; subsequent attempts will fail at `fetchFn` with a stream-lock error, which the catch path records as a normal failure. Document this limitation in a one-line comment above the helper.

Headers are merged in this order so user-supplied `init.headers` always win over `beforeFetch`'s output:
1. Copy `init.headers` into the new init (preserving a `Headers` instance if provided, else a plain object).
2. If `beforeFetch` returns a non-empty object, spread those entries on top.

## Testing Strategy

`packages/core/proxiableFetch.test.ts` — Vitest, `describe` / `it` / `expect` (matches `packages/core/url.test.ts` style). All cases drive `fetchFn` via a `vi.fn()` so the test fully controls the per-attempt response and observes call order.

Cases:

| # | Case | Assertion |
|---|---|---|
| 1 | First direct URL returns `ok` | One `fetchFn` call, returns that response. |
| 2 | Direct URL throws, second direct URL returns `ok` | Two calls, second is to the second URL. |
| 3 | Direct URL throws, first proxy returns `ok` | Two calls; second call's URL is the proxy. `beforeFetch` receives `proxyIndex: 0`. |
| 4 | Full 3×3 sequence, last proxy succeeds | Nine calls in spec order; call URLs match exactly. |
| 5 | `abortOnHttpError: false`, first response is 500 | Returns the 500, no further calls. |
| 6 | `abortOnHttpError: true` (default), first response is 500 | Fails over. |
| 7 | All attempts fail | Throws the **last** error. The first six errors are NOT chained via `cause`. |
| 8 | `beforeFetch` returns `void` | Headers unchanged. |
| 9 | `beforeFetch` returns `{ 'X-Custom': '1' }` | The header is present on the request. |
| 10 | `init.headers` is `Headers` instance, `beforeFetch` returns extra | Both sets merged; `init.headers` wins on collision. |
| 11 | `init.signal.aborted === true` before first attempt | Throws synchronously (well, on the awaited first call); zero `fetchFn` calls. |
| 12 | `init.signal.aborted === true` mid-sequence | Throws on the next attempt; remaining attempts not run. |
| 13 | `fetchFn` not provided, `globalThis.fetch` undefined | Throws with the documented message. |
| 14 | `urls` is `[]` | Throws with the documented message. |
| 15 | `reverseProxies` is undefined | Treated as `[]`; sequence is just the URLs. |
| 16 | `path` has no leading slash, URL has trailing slash | `joinUrl` test: result is `base + '/' + path` with one `/`. |
| 17 | `path` already has leading slash, URL has no trailing slash | `joinUrl` test: result is `base + path`. |
| 18 | POST with `URLSearchParams` body across two attempts | Both calls carry the same serialized body. |
| 19 | POST with `Blob` body across two attempts | Both calls carry a Blob with the same bytes (compare with `await blob.text()`). |
| 20 | `init.headers` is a plain object | Headers are still merged into the request. |

`fetchFn` is `vi.fn(async (url, init) => mockResponse)`. `mockResponse` is a stub object with `ok`, `status`, `statusText` and the methods used by the consumer; the tests only need `ok` / `status` / `statusText` because `proxiableFetch` does not read the body on the failing path.

`vi.stubGlobal('fetch', undefined)` is used in case 13 to clear `globalThis.fetch` for the test.

## Verification Plan

1. `pnpm -C packages/core typecheck` — clean.
2. `pnpm -C packages/core test proxiableFetch` — all 20 cases green.
3. `pnpm -C packages/core test` — full package suite still green (regression check; the file lives next to the other `*.test.ts` files and uses no new shared infrastructure).
4. `git grep -n 'proxiableFetch' packages` returns only the new files (no consumer added in this change).
5. Manual: import from `@smm/core/proxiableFetch` in a scratch `apps/ui` page; verify call order and `beforeFetch` headers in devtools.
