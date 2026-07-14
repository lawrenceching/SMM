# Searchbox Direct-then-General-Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `MediaDatabaseSearchbox` so TMDB/TVDB search tries the SMM-managed upstream directly first, then falls back to discovered general reverse proxies only on network failure.

**Architecture:** Add `useGeneralReverseProxyUrls` (prefer + discovered, no local SMM proxy). Add a UI search helper that wraps `@core/proxiableFetch` with `abortOnHttpError: false` and injects upstream / proxy-authorization headers only on proxied attempts. Wire `MediaDatabaseSearchbox.handleSearch` to that helper. Leave `searchTmdb` / `getTVDBv4Client` and non-Searchbox callers unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, existing `proxiableFetch`, `buildProxyRequestHeaders`, `reverseProxyServiceDiscovery`.

**Working directory for all commands:** `C:\Users\lawrence\workspace\smm_github`

**Design ref:** `docs/superpowers/specs/2026-07-09-searchbox-direct-then-general-proxy-design.md`

---

## File Map

**Create:**
- `apps/ui/src/hooks/useGeneralReverseProxyUrls.ts` — prefer + discovered general proxies only
- `apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts`
- `apps/ui/src/lib/mediaDatabaseSearchFetch.ts` — `proxiableFetch` wrapper for Searchbox search
- `apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts`

**Modify:**
- `apps/ui/src/components/MediaDatabaseSearchbox.tsx` — use new hook + helper; remove proxy-only loop
- `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx` — mock new hook / helper as needed

**Do not modify (out of scope):**
- `apps/ui/src/api/tmdb.ts` (`searchTmdb` stays for other callers)
- `apps/ui/src/lib/TvdbUtils.ts`
- `packages/core/proxiableFetch.ts`
- `apps/ui/src/lib/reverseProxyServiceDiscovery.ts`
- Untracked `apps/ui/src/lib/mediaDatabaseFetch.ts` (fixed single-proxy helper; not used by this feature)

**Reuse:**
- `ReverseProxyCandidate` type from `useReverseProxyBaseUrls.ts` (import type; do not duplicate)
- `buildProxyRequestHeaders` with `kind: "openresty"` for proxied attempts
- `SMM_TMDB_DEFAULT_UPSTREAM` / `SMM_TVDB_DEFAULT_UPSTREAM`

---

## Pre-flight

- [ ] **Step 1: Baseline Searchbox-related tests**

```bash
pnpm -C apps/ui exec vitest run src/hooks/useReverseProxyBaseUrls.test.ts src/components/MediaDatabaseSearchbox.test.tsx src/lib/proxyRequestHeaders.test.ts
```

Expected: all pass. Note pass count for later comparison.

---

## Task 1: `useGeneralReverseProxyUrls`

**Files:**
- Create: `apps/ui/src/hooks/useGeneralReverseProxyUrls.ts`
- Create: `apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useGeneralReverseProxyUrls } from "./useGeneralReverseProxyUrls"
import type { ReverseProxyEndpoint } from "@/api/discover"

const {
  mockGetDiscoveredReverseProxies,
  mockSubscribeToDiscovery,
} = vi.hoisted(() => ({
  mockGetDiscoveredReverseProxies: vi.fn<() => ReverseProxyEndpoint[]>(() => []),
  mockSubscribeToDiscovery: vi.fn<(cb: () => void) => () => void>(() => () => {}),
}))

vi.mock("@/lib/reverseProxyServiceDiscovery", () => ({
  getDiscoveredReverseProxies: () => mockGetDiscoveredReverseProxies(),
  subscribeToDiscovery: (cb: () => void) => mockSubscribeToDiscovery(cb),
}))

describe("useGeneralReverseProxyUrls", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockGetDiscoveredReverseProxies.mockReturnValue([])
    mockSubscribeToDiscovery.mockImplementation(() => () => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns empty list when nothing discovered and no prefer", () => {
    const { result } = renderHook(() => useGeneralReverseProxyUrls())
    expect(result.current).toEqual([])
  })

  it("does not include local SMM reverse proxy even if prefer is empty", () => {
    // Hook must not read appConfig.reverseProxyUrl — only discovery + prefer.
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "gz1",
        type: "general",
        url: "https://remote.example",
        authorizationMethod: "date-token",
      },
    ])
    const { result } = renderHook(() => useGeneralReverseProxyUrls())
    expect(result.current.every((c) => c.kind !== "local")).toBe(true)
    expect(result.current.map((c) => c.url)).toEqual(["https://remote.example"])
  })

  it("orders preferred localStorage URL before other discovered remotes", () => {
    localStorage.setItem(
      "preferReverseProxyBaseUrl",
      JSON.stringify({
        id: "b",
        url: "https://b.example",
        authorizationMethod: "date-token",
      }),
    )
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "a",
        type: "general",
        url: "https://a.example",
        authorizationMethod: "none",
      },
      {
        id: "b",
        type: "general",
        url: "https://b.example",
        authorizationMethod: "date-token",
      },
    ])
    const { result } = renderHook(() => useGeneralReverseProxyUrls())
    expect(result.current.map((c) => c.url)).toEqual([
      "https://b.example",
      "https://a.example",
    ])
  })

  it("deduplicates by URL", () => {
    localStorage.setItem(
      "preferReverseProxyBaseUrl",
      JSON.stringify({
        id: "a",
        url: "https://a.example",
        authorizationMethod: "none",
      }),
    )
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "a",
        type: "general",
        url: "https://a.example",
        authorizationMethod: "none",
      },
    ])
    const { result } = renderHook(() => useGeneralReverseProxyUrls())
    expect(result.current).toHaveLength(1)
  })

  it("does not issue HTTP requests", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    renderHook(() => useGeneralReverseProxyUrls())
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -C apps/ui exec vitest run src/hooks/useGeneralReverseProxyUrls.test.ts
```

Expected: FAIL (module not found / export missing).

- [ ] **Step 3: Write minimal implementation**

```ts
import { useEffect, useMemo, useState } from "react"
import {
  getDiscoveredReverseProxies,
  subscribeToDiscovery,
} from "@/lib/reverseProxyServiceDiscovery"
import localStorages from "@/lib/localStorages"
import type { ReverseProxyEndpoint } from "@/api/discover"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"

function readPreferredFromLocalStorage(): ReverseProxyCandidate | null {
  const raw = localStorages.preferReverseProxyBaseUrl
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).url === "string"
    ) {
      const { id, url, authorizationMethod } = parsed as Record<string, unknown>
      return {
        id: typeof id === "string" && id.trim() ? id : "preferred",
        kind: "openresty",
        url: url as string,
        authorizationMethod:
          authorizationMethod === "date-token" ? "date-token" : "none",
      }
    }
    return null
  } catch {
    return null
  }
}

function toCandidate(endpoint: ReverseProxyEndpoint): ReverseProxyCandidate {
  return {
    id: endpoint.id,
    kind: "openresty",
    url: endpoint.url,
    authorizationMethod: endpoint.authorizationMethod,
  }
}

function dedupe(candidates: ReverseProxyCandidate[]): ReverseProxyCandidate[] {
  const seen = new Set<string>()
  const result: ReverseProxyCandidate[] = []
  for (const c of candidates) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    result.push(c)
  }
  return result
}

/**
 * General reverse proxies for Searchbox direct-then-proxy failover.
 * Prefer (localStorage) then discovered remotes. Never includes local SMM proxy.
 */
export function useGeneralReverseProxyUrls(): ReverseProxyCandidate[] {
  const [discovered, setDiscovered] = useState<ReverseProxyEndpoint[]>(() =>
    getDiscoveredReverseProxies(),
  )
  const [localStorageVersion, setLocalStorageVersion] = useState(0)

  useEffect(() => {
    return subscribeToDiscovery(() => {
      setDiscovered(getDiscoveredReverseProxies())
    })
  }, [])

  useEffect(() => {
    const refresh = (): void => {
      setLocalStorageVersion((v) => v + 1)
    }
    window.addEventListener("storage", refresh)
    const interval = window.setInterval(refresh, 1000)
    return () => {
      window.removeEventListener("storage", refresh)
      window.clearInterval(interval)
    }
  }, [])

  return useMemo<ReverseProxyCandidate[]>(() => {
    const ordered: ReverseProxyCandidate[] = []
    const preferred = readPreferredFromLocalStorage()
    if (preferred) ordered.push(preferred)
    for (const ep of discovered) {
      ordered.push(toCandidate(ep))
    }
    return dedupe(ordered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered, localStorageVersion])
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm -C apps/ui exec vitest run src/hooks/useGeneralReverseProxyUrls.test.ts
```

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add apps/ui/src/hooks/useGeneralReverseProxyUrls.ts apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts
git commit -m "feat(ui): add useGeneralReverseProxyUrls for Searchbox failover"
```

---

## Task 2: `mediaDatabaseSearchFetch` helper

**Files:**
- Create: `apps/ui/src/lib/mediaDatabaseSearchFetch.ts`
- Create: `apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest"
import { mediaDatabaseSearchFetch } from "./mediaDatabaseSearchFetch"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json" },
  })
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const h = init?.headers
  if (!h) return {}
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  return { ...(h as Record<string, string>) }
}

const UPSTREAM = "https://tmdb-mcp-server.imlc.me/api/tmdb"
const PROXY_A: ReverseProxyCandidate = {
  id: "a",
  kind: "openresty",
  url: "https://proxy-a.example",
  authorizationMethod: "date-token",
}
const PROXY_B: ReverseProxyCandidate = {
  id: "b",
  kind: "openresty",
  url: "https://proxy-b.example",
  authorizationMethod: "none",
}

describe("mediaDatabaseSearchFetch", () => {
  it("calls upstream directly first without proxy headers", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ results: [] }))
    await mediaDatabaseSearchFetch({
      upstreamBaseUrl: UPSTREAM,
      path: "/search/tv?query=foo&language=en-US",
      proxies: [PROXY_A],
      fetchFn,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]![0]).toBe(
      `${UPSTREAM}/search/tv?query=foo&language=en-US`,
    )
    const headers = headersOf(fetchFn.mock.calls[0]![1])
    expect(headers["X-Upstream-Base-Url"]).toBeUndefined()
    expect(headers["X-Proxy-Authorization"]).toBeUndefined()
  })

  it("on direct network failure, retries via proxy with upstream + auth headers", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 1 }] }))

    const resp = await mediaDatabaseSearchFetch({
      upstreamBaseUrl: UPSTREAM,
      path: "/search/movie?query=bar&language=zh-CN",
      proxies: [PROXY_A],
      fetchFn,
    })
    expect(resp.ok).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls[1]![0]).toBe(
      "https://proxy-a.example/search/movie?query=bar&language=zh-CN",
    )
    const headers = headersOf(fetchFn.mock.calls[1]![1])
    expect(headers["X-Upstream-Base-Url"]).toBe(UPSTREAM)
    expect(headers["X-Proxy-Authorization"]).toBe("Bearer 20240507")
  })

  it("does not failover on HTTP non-2xx when abortOnHttpError is false", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "nope" }, 502))
    const resp = await mediaDatabaseSearchFetch({
      upstreamBaseUrl: UPSTREAM,
      path: "/search/tv?query=x&language=en-US",
      proxies: [PROXY_A],
      fetchFn,
    })
    expect(resp.status).toBe(502)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("omits X-Proxy-Authorization when proxy auth is none", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))

    await mediaDatabaseSearchFetch({
      upstreamBaseUrl: UPSTREAM,
      path: "/search/tv?query=x&language=en-US",
      proxies: [PROXY_B],
      fetchFn,
    })
    const headers = headersOf(fetchFn.mock.calls[1]![1])
    expect(headers["X-Upstream-Base-Url"]).toBe(UPSTREAM)
    expect(headers["X-Proxy-Authorization"]).toBeUndefined()
  })

  it("works with empty proxies (direct only)", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ results: [] }))
    await mediaDatabaseSearchFetch({
      upstreamBaseUrl: UPSTREAM,
      path: "/search/tv?query=x&language=en-US",
      proxies: [],
      fetchFn,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]![0]).toContain(UPSTREAM)
  })

  it("rejects empty upstreamBaseUrl", async () => {
    await expect(
      mediaDatabaseSearchFetch({
        upstreamBaseUrl: "   ",
        path: "/search/tv",
        proxies: [],
        fetchFn: vi.fn(async () => jsonResponse({})),
      }),
    ).rejects.toThrow(/upstreamBaseUrl/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -C apps/ui exec vitest run src/lib/mediaDatabaseSearchFetch.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import { proxiableFetch } from "@core/proxiableFetch"
import { buildProxyRequestHeaders } from "./proxyRequestHeaders"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"

export interface MediaDatabaseSearchFetchOptions {
  /** SMM-managed upstream base, e.g. SMM_TMDB_DEFAULT_UPSTREAM */
  upstreamBaseUrl: string
  /**
   * Path + query string appended to each base, e.g.
   * `/search/tv?query=foo&language=en-US`
   */
  path: string
  /** General reverse proxies only (no local SMM). */
  proxies: ReverseProxyCandidate[]
  signal?: AbortSignal
  fetchFn?: typeof fetch
}

/**
 * Direct upstream first, then general reverse proxies on network failure only.
 * Uses abortOnHttpError: false so HTTP errors do not failover.
 */
export async function mediaDatabaseSearchFetch(
  options: MediaDatabaseSearchFetchOptions,
): Promise<Response> {
  const upstreamBaseUrl = options.upstreamBaseUrl.trim().replace(/\/+$/, "")
  if (!upstreamBaseUrl) {
    throw new Error("mediaDatabaseSearchFetch: upstreamBaseUrl is required")
  }

  const authByUrl = new Map(
    options.proxies.map((p) => [p.url.replace(/\/+$/, ""), p.authorizationMethod] as const),
  )
  const reverseProxies = options.proxies.map((p) => p.url.replace(/\/+$/, ""))

  return proxiableFetch(
    {
      path: options.path.startsWith("/") ? options.path : `/${options.path}`,
      urls: [upstreamBaseUrl],
      reverseProxies,
      abortOnHttpError: false,
      fetchFn: options.fetchFn,
      beforeFetch: ({ proxy }) => {
        if (!proxy) {
          return { Accept: "application/json" }
        }
        const normalizedProxy = proxy.replace(/\/+$/, "")
        const authorizationMethod = authByUrl.get(normalizedProxy) ?? "none"
        return buildProxyRequestHeaders({
          kind: "openresty",
          upstreamBaseURL: upstreamBaseUrl,
          authorizationMethod,
        })
      },
    },
    {
      method: "GET",
      signal: options.signal,
      cache: "no-store",
    },
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm -C apps/ui exec vitest run src/lib/mediaDatabaseSearchFetch.test.ts
```

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add apps/ui/src/lib/mediaDatabaseSearchFetch.ts apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts
git commit -m "feat(ui): add mediaDatabaseSearchFetch direct-then-proxy helper"
```

---

## Task 3: Wire `MediaDatabaseSearchbox` to helper

**Files:**
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.tsx`
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx`

- [ ] **Step 1: Update Searchbox test mocks**

In `MediaDatabaseSearchbox.test.tsx`, replace:

```ts
vi.mock('@/hooks/useReverseProxyBaseUrls', () => ({
  useReverseProxyBaseUrls: vi.fn(() => []),
}))
```

with:

```ts
vi.mock('@/hooks/useGeneralReverseProxyUrls', () => ({
  useGeneralReverseProxyUrls: vi.fn(() => []),
}))
```

Keep existing language / ImmersiveSearchbox mocks. Existing tests that only cover language UI should still pass.

- [ ] **Step 2: Run Searchbox tests — expect FAIL or mock mismatch**

```bash
pnpm -C apps/ui exec vitest run src/components/MediaDatabaseSearchbox.test.tsx
```

Expected: FAIL because component still imports `useReverseProxyBaseUrls`.

- [ ] **Step 3: Rewrite `handleSearch` to use the helper**

Replace imports:

```ts
// remove: searchTmdb, getTVDBv4Client, useReverseProxyBaseUrls (for search path)
import { getTMDBImageUrl, SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { SMM_TVDB_DEFAULT_UPSTREAM } from "@/lib/TvdbUtils"
import { useGeneralReverseProxyUrls } from "@/hooks/useGeneralReverseProxyUrls"
import { mediaDatabaseSearchFetch } from "@/lib/mediaDatabaseSearchFetch"
import type { TmdbSearchResponseBody } from "@core/types"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
```

Inside the component:

```ts
const generalProxies = useGeneralReverseProxyUrls()
```

Replace the body of `handleSearch` (keep empty-query early return and loading/error state setup) with:

```ts
const handleSearch = useCallback(async () => {
  if (!searchQuery.trim()) {
    setSearchResults([])
    setTvdbSearchResultsRaw([])
    setSearchError(null)
    return
  }

  setIsSearching(true)
  setSearchError(null)
  setSearchResults([])
  setTvdbSearchResultsRaw([])

  try {
    if (searchDatabase === "TVDB") {
      const query = searchQuery.trim()
      const type = mediaType === "tv" ? "series" : "movie"
      const params = new URLSearchParams()
      params.set("query", query)
      params.set("type", type)
      if (searchLanguage.trim()) params.set("language", searchLanguage)

      const resp = await mediaDatabaseSearchFetch({
        upstreamBaseUrl: SMM_TVDB_DEFAULT_UPSTREAM,
        path: `/search?${params.toString()}`,
        proxies: generalProxies,
      })

      if (!resp.ok) {
        setSearchError(t("errors:searchFailed"))
        return
      }

      const body = (await resp.json()) as {
        status?: string
        data?: TVDBv4SearchResult[]
      }
      const result =
        body.status === "success" && Array.isArray(body.data) ? body.data : undefined

      if (result && result.length > 0) {
        setTvdbSearchResultsRaw(buildTvdbSearchResults(result))
        return
      }
      setSearchError(t("errors:searchNoResults"))
      return
    }

    // TMDB
    const params = new URLSearchParams()
    params.set("query", searchQuery.trim())
    params.set("language", searchLanguage)
    const resp = await mediaDatabaseSearchFetch({
      upstreamBaseUrl: SMM_TMDB_DEFAULT_UPSTREAM,
      path: `/search/${mediaType}?${params.toString()}`,
      proxies: generalProxies,
    })

    if (!resp.ok) {
      setSearchError(t("errors:searchFailed"))
      return
    }

    const response = (await resp.json()) as TmdbSearchResponseBody
    if (response.error) {
      setSearchError(t("errors:searchFailed"))
      return
    }

    const results = response.results.filter(
      (item): item is TMDBTVShow | TMDBMovie =>
        mediaType === "tv" ? "name" in item : "title" in item,
    )
    setSearchResults(results)
    if (results.length === 0) {
      setSearchError(t("errors:searchNoResults"))
    }
  } catch (error) {
    console.error("Search failed:", error)
    setSearchError(
      error instanceof Error ? error.message : t("errors:searchFailed"),
    )
    setSearchResults([])
    setTvdbSearchResultsRaw([])
  } finally {
    setIsSearching(false)
  }
}, [searchQuery, searchLanguage, searchDatabase, mediaType, t, generalProxies])
```

Remove unused imports (`searchTmdb`, `getTVDBv4Client`, `useReverseProxyBaseUrls`) if nothing else needs them.

- [ ] **Step 4: Run Searchbox + helper + hook tests — expect PASS**

```bash
pnpm -C apps/ui exec vitest run \
  src/hooks/useGeneralReverseProxyUrls.test.ts \
  src/lib/mediaDatabaseSearchFetch.test.ts \
  src/components/MediaDatabaseSearchbox.test.tsx
```

- [ ] **Step 5: Optional integration-style unit test on Searchbox search path**

Add one test that mocks `mediaDatabaseSearchFetch` and asserts `onSearch` path sets results. Only if existing Searchbox tests do not already cover search execution; keep it small:

```ts
vi.mock('@/lib/mediaDatabaseSearchFetch', () => ({
  mediaDatabaseSearchFetch: vi.fn(),
}))
```

If ImmersiveSearchbox mock does not expose `onSearch`, skip this step — Task 2 already covers failover semantics.

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add apps/ui/src/components/MediaDatabaseSearchbox.tsx apps/ui/src/components/MediaDatabaseSearchbox.test.tsx
git commit -m "feat(ui): Searchbox direct upstream then general reverse proxy"
```

---

## Task 4: Verification

- [ ] **Step 1: Run focused regression suite**

```bash
pnpm -C apps/ui exec vitest run \
  src/hooks/useGeneralReverseProxyUrls.test.ts \
  src/hooks/useReverseProxyBaseUrls.test.ts \
  src/lib/mediaDatabaseSearchFetch.test.ts \
  src/lib/proxyRequestHeaders.test.ts \
  src/components/MediaDatabaseSearchbox.test.tsx \
  src/api/tmdb.test.ts
```

Expected: all pass. `tmdb.test.ts` unchanged behaviour for non-Searchbox callers.

- [ ] **Step 2: Spec checklist**

Confirm against design doc:

| Spec item | Task |
|-----------|------|
| Direct first | Task 2 + 3 |
| General proxies only (no local) | Task 1 |
| Network-only failover | Task 2 (`abortOnHttpError: false`) |
| Empty results stop | Task 3 |
| Proxy headers on proxied attempts | Task 2 |
| Out-of-scope callers untouched | Task 4 (`tmdb.test.ts`) |

- [ ] **Step 3: Commit design/plan status note** (only if user asked)

Optionally append to the design spec: `Status: Implemented YYYY-MM-DD`.

---

## Self-Review (plan author)

1. **Spec coverage:** Direct-first, general-proxy-only list, network-only failover, empty-results stop, Searchbox-only scope — all mapped to Tasks 1–3.
2. **Placeholders:** None; code and commands are concrete.
3. **Types:** `ReverseProxyCandidate` reused; helper options named consistently across tasks.
4. **Note:** Existing untracked `mediaDatabaseFetch.ts` is a different fixed-proxy helper; this plan intentionally adds `mediaDatabaseSearchFetch.ts` instead of extending it.
