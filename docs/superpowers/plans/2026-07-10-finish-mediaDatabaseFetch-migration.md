# Finish `mediaDatabaseFetch` → `fetchTmdb` / `fetchTvdb` Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** Planned 2026-07-10.

**Goal:** Migrate the two remaining `mediaDatabaseFetch` callers (MediaDatabaseSearchbox, TvdbUtils) to the new `fetchTmdb` / `fetchTvdb` entry points, drop the now-unused wrappers, and remove `generalProxies` from `getTVDBv4Client`. Keep `mediaDatabaseFetch` itself for any future callers.

**Architecture:** `fetchTmdb` / `fetchTvdb` already read upstream host, api key, httpProxy, and discover config from `userConfig`. They cover the two paths the callers need: custom host → local SMM reverse proxy, default upstream → direct then discovered general reverse proxies. Callers stop passing `upstreamBaseUrl` / `localReverseProxyUrl` / `generalProxies` / `apiKey`; they pass the URL path (and signal) only. After this change the only remaining `mediaDatabaseFetch` reference in the tree is the deprecated helper file itself.

**Tech Stack:** React 19, TypeScript, Vitest, TanStack Query, existing `fetchWithFailover` in `apps/ui/src/lib/http.ts`.

**Working directory:** `C:\Users\lawrence\workspace\smm_github`

---

## File map

**Modify:**
- `apps/ui/src/lib/TvdbUtils.ts` — drop `generalProxies` from `GetTVDBv4ClientOverrides`; replace `buildMediaDatabaseTvdbFetchImpl` body to delegate to `fetchTvdb`; simplify `buildTvdbClient` branching; update `buildClientCacheKey`
- `apps/ui/src/lib/TvdbUtils.test.ts` — drop tests that assert the deprecated local-SMM-proxy path for the SMM default upstream; add a construction-shape assertion for the new path
- `apps/ui/src/hooks/useTvdbQueries.ts` — remove `getGeneralReverseProxyCandidates` import; drop `generalProxies` from `getTvdbClientOptions`
- `apps/ui/src/hooks/useTvdbLanguages.ts` — remove `getGeneralReverseProxyCandidates` import; drop `generalProxies`; simplify `enabled` to `true`
- `apps/ui/src/components/MediaDatabaseSearchbox.tsx` — replace `mediaDatabaseFetch` calls with `fetchTmdb` / `fetchTvdb`; drop `useGeneralReverseProxyUrls` and `SMM_TVDB_DEFAULT_UPSTREAM` use
- `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx` — drop `useGeneralReverseProxyUrls` mock; mock `@/api/tmdb` + `@/api/tvdb`; capture `onSearch` on ImmersiveSearchbox mock; add a focused test for the new search path
- `apps/ui/src/lib/mediaDatabaseFetch.ts` — refresh the `@deprecated` JSDoc to list the now-removed helpers and point new callers at `fetchTmdb` / `fetchTvdb`

**Delete:**
- `apps/ui/src/lib/mediaDatabaseSearchFetch.ts`
- `apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts`
- `apps/ui/src/hooks/useGeneralReverseProxyUrls.ts`
- `apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts`
- `apps/ui/src/lib/generalReverseProxyCandidates.ts`
- `apps/ui/src/lib/generalReverseProxyCandidates.test.ts`

**Do not modify (out of scope):**
- `apps/ui/src/api/tmdb.ts`, `apps/ui/src/api/tmdb.test.ts` — `fetchTmdb` is the public API; `searchTmdb` / `getMovieById` / `getTvShowById` / `getSeason` / `getTmdbPrimaryTranslations` / `getTmdbLanguages` already use it
- `apps/ui/src/api/tvdb.ts`, `apps/ui/src/api/tvdb.test.ts` — same as above for `fetchTvdb`
- `apps/ui/src/lib/http.ts` (`fetchWithFailover`) — unchanged; `fetchTmdb` / `fetchTvdb` continue to use it
- `apps/ui/src/hooks/useScrapeNfoMutation.ts` and `.test.ts` — already routes through `useTmdbQueries` / `useTvdbQueries`
- `apps/ui/src/hooks/useReverseProxyBaseUrls.ts` and `.test.ts` — unrelated to this migration
- `apps/ui/src/lib/mediaDatabaseFetch.test.ts` — keep; covers the kept helper
- `apps/ui/src/lib/mediaDatabaseAccess.ts` — still used as a shared helper for `proxyRequestHeaders` tests

**Reuse:**
- `fetchTmdb` from `apps/ui/src/api/tmdb.ts`
- `fetchTvdb` from `apps/ui/src/api/tvdb.ts`
- `buildLocalProxyRequestHeaders` from `apps/ui/src/lib/proxyRequestHeaders.ts` (custom-upstream path in `buildTvdbClient`)
- `SMM_TVDB_DEFAULT_UPSTREAM` from `apps/ui/src/lib/TvdbUtils.ts`

---

## Pre-flight

- [ ] **Step 1: Capture current test baseline**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run \
  src/api/tmdb.test.ts \
  src/api/tvdb.test.ts \
  src/lib/TvdbUtils.test.ts \
  src/lib/mediaDatabaseFetch.test.ts \
  src/lib/mediaDatabaseSearchFetch.test.ts \
  src/lib/generalReverseProxyCandidates.test.ts \
  src/hooks/useTvdbLanguages.test.tsx \
  src/hooks/useTvdbQueries.test.ts \
  src/hooks/useGeneralReverseProxyUrls.test.ts \
  src/components/MediaDatabaseSearchbox.test.tsx \
  src/hooks/useScrapeNfoMutation.test.ts
```

Expected: all pass. Note the pass count and which files we will delete so we can confirm the deletion step is safe.

---

## Task 1: Migrate `TvdbUtils` to `fetchTvdb` and drop `generalProxies`

**Files:**
- Modify: `apps/ui/src/lib/TvdbUtils.ts`
- Modify: `apps/ui/src/lib/TvdbUtils.test.ts`

- [ ] **Step 1: Write the failing construction test**

Append to `apps/ui/src/lib/TvdbUtils.test.ts`, inside the `describe("getTVDBv4Client", ...)` block (after the existing `injects X-SMM-Proxy-Upstream-BaseURL with configured TVDB host` test):

```ts
it("uses fetchTvdb fetchImpl for the SMM-managed default upstream", () => {
  // Default upstream = SMM_TVDB_DEFAULT_UPSTREAM. After migration, the TVDB
  // client is constructed with baseUrl = SMM upstream and fetchImpl delegates
  // to fetchTvdb (direct + discovered general reverse proxies). The actual
  // fetchTvdb behaviour is covered in tvdb.test.ts; here we only assert the
  // construction shape so TvdbUtils stays decoupled from the fetch chain.
  getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
  const options = mockTvdbConstructor.mock.calls.at(-1)?.[0] as {
    baseUrl?: string
    disableAuth?: boolean
    fetchImpl?: unknown
  }
  expect(options.baseUrl).toBe(SMM_TVDB_DEFAULT_UPSTREAM)
  expect(options.disableAuth).toBe(true)
  expect(typeof options.fetchImpl).toBe("function")
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run src/lib/TvdbUtils.test.ts
```

Expected: FAIL on the new test. (The current code routes the SMM-managed default upstream through the local SMM proxy because `generalProxies` is undefined, so `baseUrl` is `REVERSE_PROXY_URL`, not `SMM_TVDB_DEFAULT_UPSTREAM`.)

- [ ] **Step 3: Update `TvdbUtils.ts`**

Edit `apps/ui/src/lib/TvdbUtils.ts`:

1. Add the import for `fetchTvdb`:

```ts
import { fetchTvdb } from "@/api/tvdb"
```

2. Drop the unused `ReverseProxyCandidate` import (it is no longer referenced inside this file once `generalProxies` is gone):

```ts
// Remove this line:
// import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"
```

3. Replace `GetTVDBv4ClientOverrides`:

```ts
export interface GetTVDBv4ClientOverrides {
    reverseProxyUrl?: string | null
    upstreamBaseURL?: string
    apiKey?: string
    authorizationMethod?: ProxyAuthorizationMethod
}
```

4. Replace `resolveTvdbUpstream`:

```ts
function resolveTvdbUpstream(overrides?: GetTVDBv4ClientOverrides): TvdbUpstream {
    const upstreamBaseURL =
        overrides?.upstreamBaseURL?.trim() || SMM_TVDB_DEFAULT_UPSTREAM
    const reverseProxyUrl = overrides?.reverseProxyUrl
    if (!reverseProxyUrl) {
        throw new Error(
            "Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.",
        )
    }
    const apiKey = overrides?.apiKey?.trim() || undefined
    return {
        reverseProxyUrl,
        upstreamBaseURL,
        apiKey,
        requiresAuth: isCustomUpstream(upstreamBaseURL, SMM_TVDB_DEFAULT_UPSTREAM),
        authorizationMethod: overrides?.authorizationMethod ?? "none",
    }
}
```

Note: we keep the `reverseProxyUrl` guard. It is required by the local SMM proxy code path that custom-upstream clients still use. The default-upstream path delegates to `fetchTvdb`, which can fall back to discovered reverse proxies, but `resolveTvdbUpstream` is still used as the construction entry point so we keep the validation.

5. Replace `buildClientCacheKey`:

```ts
function buildClientCacheKey(upstream: TvdbUpstream): string {
    return [
        upstream.reverseProxyUrl,
        upstream.upstreamBaseURL,
        upstream.apiKey ?? "",
        upstream.authorizationMethod,
    ].join("|")
}
```

6. Replace `buildMediaDatabaseTvdbFetchImpl` to delegate to `fetchTvdb`:

```ts
function buildMediaDatabaseTvdbFetchImpl(
    upstream: TvdbUpstream,
): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString =
            typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.href
                    : input.url
        const upstreamBase = upstream.upstreamBaseURL.replace(/\/+$/, "")
        const path = urlString.startsWith(upstreamBase)
            ? urlString.slice(upstreamBase.length) || "/"
            : new URL(urlString).pathname + new URL(urlString).search
        return fetchTvdb(
            path.startsWith("/") ? path : `/${path}`,
            { signal: init?.signal },
        ) as unknown as Promise<Response>
    }
}
```

7. Replace `buildTvdbClient` to drop the `useFailover` branching. The two paths are now decided purely by `isCustomUpstream`:

```ts
function buildTvdbClient(upstream: TvdbUpstream): TVDBv4 {
    if (isCustomUpstream(upstream.upstreamBaseURL, SMM_TVDB_DEFAULT_UPSTREAM)) {
        return new TVDBv4({
            baseUrl: upstream.reverseProxyUrl,
            apiKey: upstream.apiKey ?? "",
            disableAuth: !(upstream.requiresAuth && Boolean(upstream.apiKey)),
            fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers)
                const proxyHeaders = buildLocalProxyRequestHeaders({
                    upstreamBaseURL: upstream.upstreamBaseURL,
                })
                for (const [key, value] of Object.entries(proxyHeaders)) {
                    if (key.toLowerCase() === "accept") continue
                    headers.set(key, value)
                }
                return window.fetch(input, { ...init, headers })
            },
        })
    }

    return new TVDBv4({
        baseUrl: upstream.upstreamBaseURL,
        apiKey: upstream.apiKey ?? "",
        disableAuth: true,
        fetchImpl: buildMediaDatabaseTvdbFetchImpl(upstream),
    })
}
```

8. `getTVDBv4Client` keeps its signature. Only `buildClientCacheKey` and `buildTvdbClient` change shape. No edit needed at the call site, but confirm:

```ts
export function getTVDBv4Client(overrides?: GetTVDBv4ClientOverrides): TVDBv4 {
    const upstream = resolveTvdbUpstream(overrides)
    const key = buildClientCacheKey(upstream)
    const cached = tvdbClientCache.get(key)
    if (cached) return cached
    const client = buildTvdbClient(upstream)
    tvdbClientCache.set(key, client)
    return client
}
```

- [ ] **Step 4: Update `TvdbUtils.test.ts` for the new behaviour**

1. Delete the test `injects X-SMM-Proxy-Upstream-BaseURL on every fetchImpl call (SMM-managed upstream)` — it asserts the deprecated local-SMM-proxy path for the SMM-managed default upstream, which is exactly what we are removing.
2. Update the existing `targets reverse proxy and SMM-managed default upstream when no TVDB host is configured` test. With the new design, the SMM-managed default upstream is routed through `fetchTvdb`, not the local SMM proxy. Replace the body with:

```ts
it("uses fetchTvdb fetchImpl for the SMM-managed default upstream when no TVDB host is configured", () => {
  getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
  expect(mockTvdbConstructor).toHaveBeenCalledTimes(1)
  const options = mockTvdbConstructor.mock.calls[0][0] as {
    baseUrl?: string
    disableAuth?: boolean
    apiKey?: string
    fetchImpl?: unknown
  }
  expect(options.baseUrl).toBe(SMM_TVDB_DEFAULT_UPSTREAM)
  expect(options.disableAuth).toBe(true)
  expect(options.apiKey).toBe("")
  expect(typeof options.fetchImpl).toBe("function")
})
```

3. The custom-upstream tests (`enables auth and forwards apiKey when configured TVDB host is direct and apiKey is set`, `keeps auth disabled when configured TVDB host is direct but no apiKey is set`, `injects X-SMM-Proxy-Upstream-BaseURL with configured TVDB host`, `memoizes the client per (reverseProxyUrl, upstreamBaseURL, apiKey)`) all still pass — the custom-upstream code path is unchanged.
4. The `throws when no reverse proxy URL is available` test still passes — the guard is preserved in `resolveTvdbUpstream`.

- [ ] **Step 5: Run — expect PASS**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run src/lib/TvdbUtils.test.ts
```

Expected: all pass, including the construction test from Step 1 and the renamed "uses fetchTvdb fetchImpl" test.

---

## Task 2: Update TVDB client callers

**Files:**
- Modify: `apps/ui/src/hooks/useTvdbQueries.ts`
- Modify: `apps/ui/src/hooks/useTvdbLanguages.ts`

- [ ] **Step 1: `useTvdbQueries` — drop `generalProxies`**

In `apps/ui/src/hooks/useTvdbQueries.ts`:

1. Remove the import:

```ts
// Remove this line:
// import { getGeneralReverseProxyCandidates } from "@/lib/generalReverseProxyCandidates"
```

2. Remove the `generalProxies` field from `getTvdbClientOptions`. The final callback:

```ts
const getTvdbClientOptions = useCallback(() => ({
    reverseProxyUrl: getReverseProxyUrl(),
    upstreamBaseURL: userConfig.tvdb?.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM,
    apiKey: userConfig.tvdb?.apiKey?.trim() || undefined,
}), [getReverseProxyUrl, userConfig.tvdb?.host, userConfig.tvdb?.apiKey])
```

- [ ] **Step 2: `useTvdbLanguages` — drop `generalProxies` and simplify `enabled`**

In `apps/ui/src/hooks/useTvdbLanguages.ts`:

1. Remove the import:

```ts
// Remove this line:
// import { getGeneralReverseProxyCandidates } from "@/lib/generalReverseProxyCandidates"
```

2. Remove `generalProxies: getGeneralReverseProxyCandidates()` from `useTvdbRequestOptions`. The final return value:

```ts
return {
    reverseProxyUrl,
    upstreamBaseURL: userConfig.tvdb?.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM,
    apiKey: userConfig.tvdb?.apiKey?.trim() || undefined,
}
```

3. Simplify `enabled` on the `useQuery` call. With `fetchTvdb`, the query is always runnable: a custom host uses the local SMM reverse proxy, and the default upstream uses `fetchWithFailover` (which falls back to discovered reverse proxies). Replace:

```ts
enabled: Boolean(options.reverseProxyUrl) || options.generalProxies !== undefined,
```

with:

```ts
enabled: true,
```

- [ ] **Step 3: Run — expect PASS**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run \
  src/hooks/useTvdbQueries.test.ts \
  src/hooks/useTvdbLanguages.test.tsx
```

Expected: all pass. The mocks in `useTvdbLanguages.test.tsx` already stub `@/lib/TvdbUtils.getTvdbLanguages`, so the dropped `generalProxies` field does not affect those tests.

---

## Task 3: Migrate `MediaDatabaseSearchbox` to `fetchTmdb` / `fetchTvdb`

**Files:**
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.tsx`
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx`

- [ ] **Step 1: Wire the test mocks and capture `onSearch`**

In `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx`:

1. Update the `mockImmersiveSearchboxProps` type to include `onSearch`:

```ts
const mockImmersiveSearchboxProps = {
  current: {} as {
    value: string
    searchLanguage: string
    onSearchLanguageChange: (v: string) => void
    showAllLanguages: boolean
    onShowAllLanguagesChange: (v: boolean) => void
    searchLanguageOptions: ReadonlyArray<{ code: string; name: string }>
    onSearch?: () => void | Promise<void>
  },
}
```

2. Update the ImmersiveSearchbox mock to capture `onSearch` and render a "trigger search" button:

```ts
vi.mock('./ImmersiveSearchbox', () => ({
  ImmersiveSearchbox: vi.fn((props: any) => {
    const {
      value, onChange, placeholder, inputClassName, onSelect, onSearch,
      searchLanguage, onSearchLanguageChange, showAllLanguages,
      onShowAllLanguagesChange, searchLanguageOptions,
    } = props
    mockImmersiveSearchboxProps.current = {
      value, searchLanguage, onSearchLanguageChange,
      showAllLanguages, onShowAllLanguagesChange, searchLanguageOptions, onSearch,
    }
    const fakeResult = { id: 1, name: 'Test Show' }
    return (
      <div data-testid="immersive-searchbox">
        <input
          data-testid="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          type="button"
          data-testid="select-result"
          onClick={() => onSelect(fakeResult)}
        >
          Select
        </button>
        <button
          type="button"
          data-testid="trigger-search"
          onClick={() => { void onSearch?.() }}
        >
          Search
        </button>
        <span data-testid="language-options-count">
          {(searchLanguageOptions ?? []).length}
        </span>
      </div>
    )
  }),
}))
```

3. Mock `fetchTmdb` and `fetchTvdb` at the module level. Place these hoisted stubs + `vi.mock` calls near the top of the file (just after the existing `vi.mock` blocks):

```ts
const { mockFetchTmdb, mockFetchTvdb } = vi.hoisted(() => ({
  mockFetchTmdb: vi.fn(),
  mockFetchTvdb: vi.fn(),
}))

vi.mock('@/api/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tmdb')>()
  return { ...actual, fetchTmdb: mockFetchTmdb }
})

vi.mock('@/api/tvdb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tvdb')>()
  return { ...actual, fetchTvdb: mockFetchTvdb }
})
```

4. Remove the `useGeneralReverseProxyUrls` mock (the component no longer reads it):

```ts
// Delete this block:
// vi.mock('@/hooks/useGeneralReverseProxyUrls', () => ({
//   useGeneralReverseProxyUrls: vi.fn(() => []),
// }))
```

5. Add `waitFor` to the imports:

```ts
import { act, render, waitFor } from '@testing-library/react'
```

- [ ] **Step 2: Add the failing search-path tests**

Append to `describe('MediaDatabaseSearchbox', ...)`:

```ts
it('handleSearch calls fetchTmdb with /search/tv? when database is TMDB', async () => {
  mockFetchTmdb.mockResolvedValue(
    new Response(JSON.stringify({ results: [] }), { status: 200 }),
  )
  render(<MediaDatabaseSearchbox {...defaultProps} value="naruto" />, {
    wrapper: createWrapper(),
  })

  act(() => mockImmersiveSearchboxProps.current.onSearch?.())

  await waitFor(() => expect(mockFetchTmdb).toHaveBeenCalledTimes(1))
  const [urlPath] = mockFetchTmdb.mock.calls[0] as [string]
  expect(urlPath.startsWith('/search/tv?')).toBe(true)
  expect(urlPath).toContain('query=naruto')
  expect(mockFetchTvdb).not.toHaveBeenCalled()
})

it('handleSearch calls fetchTvdb with /search?type=movie when database is TVDB and mediaType is movie', async () => {
  vi.mocked(useConfig).mockReturnValue({
    userConfig: {
      applicationLanguage: 'en',
      primaryDatabase: 'TVDB',
      preferMediaLanguage: 'en-US',
      tmdb: {},
      tvdb: {},
    },
    appConfig: { reverseProxyUrl: 'http://127.0.0.1:30005' },
  } as any)
  mockFetchTvdb.mockResolvedValue(
    new Response(JSON.stringify({ status: 'success', data: [] }), { status: 200 }),
  )
  render(
    <MediaDatabaseSearchbox
      mediaType="movie"
      value="inception"
      onSearchResultSelected={vi.fn()}
    />,
    { wrapper: createWrapper() },
  )

  act(() => mockImmersiveSearchboxProps.current.onSearch?.())

  await waitFor(() => expect(mockFetchTvdb).toHaveBeenCalledTimes(1))
  const [urlPath] = mockFetchTvdb.mock.calls[0] as [string]
  expect(urlPath.startsWith('/search?')).toBe(true)
  expect(urlPath).toContain('type=movie')
  expect(urlPath).toContain('query=inception')
  expect(mockFetchTmdb).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run src/components/MediaDatabaseSearchbox.test.tsx
```

Expected: FAIL on the two new tests. The current `handleSearch` calls `mediaDatabaseFetch`, not the mocked `fetchTmdb` / `fetchTvdb`. The existing 18 tests should still pass since they do not exercise the search path.

- [ ] **Step 4: Update `MediaDatabaseSearchbox.tsx`**

Edit `apps/ui/src/components/MediaDatabaseSearchbox.tsx`:

1. Replace the `tmdb` import to also bring in `fetchTmdb`:

```ts
import { fetchTmdb, getTMDBImageUrl, SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
```

2. Add the new `fetchTvdb` import:

```ts
import { fetchTvdb } from "@/api/tvdb"
```

3. Drop the two imports we no longer need:

```ts
// Remove:
// import { useGeneralReverseProxyUrls } from "@/hooks/useGeneralReverseProxyUrls"
// import { mediaDatabaseFetch } from "@/lib/mediaDatabaseFetch"
```

4. Keep the `SMM_TVDB_DEFAULT_UPSTREAM` import (still used inside the new `handleSearch`).

5. Inside the component body, drop the `useGeneralReverseProxyUrls` call. Remove this line:

```ts
// Remove:
// const generalProxies = useGeneralReverseProxyUrls()
```

6. Replace the body of `handleSearch` (keep the empty-query early return and the loading/error state setup) with:

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
      const type = mediaType === "tv" ? "series" : "movie"
      const params = new URLSearchParams()
      params.set("query", searchQuery.trim())
      params.set("type", type)
      if (searchLanguage.trim()) params.set("language", searchLanguage)

      const resp = await fetchTvdb(`/search?${params.toString()}`)
      if (!resp || !resp.ok) {
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

    const params = new URLSearchParams()
    params.set("query", searchQuery.trim())
    params.set("language", searchLanguage)
    const resp = await fetchTmdb(`/search/${mediaType}?${params.toString()}`)
    if (!resp || !resp.ok) {
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
}, [searchQuery, searchLanguage, searchDatabase, mediaType, t])
```

7. `appConfig` is no longer referenced in `handleSearch`; the existing `const { userConfig, appConfig } = useConfig()` line can keep the destructure (other code paths still use `appConfig` if any) — but if the only remaining use was in the old `handleSearch`, simplify to `const { userConfig } = useConfig()`. Inspect before editing; only drop the destructure if `appConfig` is no longer used anywhere else in the file.

- [ ] **Step 5: Run — expect PASS**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run src/components/MediaDatabaseSearchbox.test.tsx
```

Expected: all pass, including the two new search-path tests.

---

## Task 4: Remove unused helpers

**Files:**
- Delete: `apps/ui/src/lib/mediaDatabaseSearchFetch.ts`
- Delete: `apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts`
- Delete: `apps/ui/src/hooks/useGeneralReverseProxyUrls.ts`
- Delete: `apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts`
- Delete: `apps/ui/src/lib/generalReverseProxyCandidates.ts`
- Delete: `apps/ui/src/lib/generalReverseProxyCandidates.test.ts`
- Modify: `apps/ui/src/lib/mediaDatabaseFetch.ts` (JSDoc only)

- [ ] **Step 1: Delete the three helpers and their tests**

```bash
cd C:/Users/lawrence/workspace/smm_github
rm apps/ui/src/lib/mediaDatabaseSearchFetch.ts
rm apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts
rm apps/ui/src/hooks/useGeneralReverseProxyUrls.ts
rm apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts
rm apps/ui/src/lib/generalReverseProxyCandidates.ts
rm apps/ui/src/lib/generalReverseProxyCandidates.test.ts
```

- [ ] **Step 2: Refresh the `@deprecated` JSDoc on `mediaDatabaseFetch`**

In `apps/ui/src/lib/mediaDatabaseFetch.ts`, replace the existing `/** @deprecated, use fetchTmdb and fetchTvdb instead */` block with a more accurate comment that lists the removed wrappers:

```ts
/**
 * @deprecated Direct callers should use `fetchTmdb` (apps/ui/src/api/tmdb.ts)
 * or `fetchTvdb` (apps/ui/src/api/tvdb.ts) instead. This helper is kept only
 * for backwards compatibility. The intermediate wrappers
 * `mediaDatabaseSearchFetch`, `useGeneralReverseProxyUrls`, and
 * `getGeneralReverseProxyCandidates` have been removed in 2026-07-10.
 */
```

- [ ] **Step 3: Run — expect no new failures**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run \
  src/api/tmdb.test.ts \
  src/api/tvdb.test.ts \
  src/lib/TvdbUtils.test.ts \
  src/lib/mediaDatabaseFetch.test.ts \
  src/hooks/useTvdbLanguages.test.tsx \
  src/hooks/useTvdbQueries.test.ts \
  src/components/MediaDatabaseSearchbox.test.tsx \
  src/hooks/useScrapeNfoMutation.test.ts
```

Expected: all pass. The deleted files are no longer picked up by the runner. The kept files do not import the deleted helpers.

- [ ] **Step 4: Type-check the whole `apps/ui` workspace**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec tsc --noEmit
```

Expected: no errors. Any leftover import of the deleted files will surface here.

---

## Task 5: Final verification

- [ ] **Step 1: Run the full UI test suite**

```bash
cd C:/Users/lawrence/workspace/smm_github
pnpm -C apps/ui exec vitest run
```

Expected: all pass. Compare pass count with the pre-flight baseline — it should match or improve (we deleted six test files, so the absolute count drops, but no regressions).

- [ ] **Step 2: Confirm the migration is complete (code search)**

```bash
cd C:/Users/lawrence/workspace/smm_github
grep -rn "mediaDatabaseFetch\|useGeneralReverseProxyUrls\|getGeneralReverseProxyCandidates\|mediaDatabaseSearchFetch" apps/ui/src
```

Expected: the only matches are inside `apps/ui/src/lib/mediaDatabaseFetch.ts` and `apps/ui/src/lib/mediaDatabaseFetch.test.ts` (the kept file). No production code references the removed helpers.

- [ ] **Step 3: Optional commit (only if user asked)**

```bash
cd C:/Users/lawrence/workspace/smm_github
git add apps/ui/src/lib/TvdbUtils.ts apps/ui/src/lib/TvdbUtils.test.ts \
        apps/ui/src/hooks/useTvdbQueries.ts \
        apps/ui/src/hooks/useTvdbLanguages.ts \
        apps/ui/src/components/MediaDatabaseSearchbox.tsx \
        apps/ui/src/components/MediaDatabaseSearchbox.test.tsx \
        apps/ui/src/lib/mediaDatabaseFetch.ts
git rm apps/ui/src/lib/mediaDatabaseSearchFetch.ts \
       apps/ui/src/lib/mediaDatabaseSearchFetch.test.ts \
       apps/ui/src/hooks/useGeneralReverseProxyUrls.ts \
       apps/ui/src/hooks/useGeneralReverseProxyUrls.test.ts \
       apps/ui/src/lib/generalReverseProxyCandidates.ts \
       apps/ui/src/lib/generalReverseProxyCandidates.test.ts
git commit -m "refactor(ui): finish mediaDatabaseFetch → fetchTmdb/fetchTvdb migration"
```

---

## Self-Review (plan author)

1. **Spec coverage:** All remaining `mediaDatabaseFetch` callers migrate (`MediaDatabaseSearchbox`, `TvdbUtils.buildMediaDatabaseTvdbFetchImpl`). The deprecated helper file is kept per user request. The new search-path test in `MediaDatabaseSearchbox` is added. `generalProxies` is dropped from `getTVDBv4Client` and all callers.
2. **Placeholders:** Every step has concrete code and exact commands. No TBD / TODO.
3. **Type consistency:** `fetchTmdb` and `fetchTvdb` return `Response | undefined` (undefined when every attempt fails). The new `handleSearch` treats `!resp` and `!resp.ok` as the failure path — same surface as before. `getTVDBv4Client` keeps its return type; only the override type narrows. `enabled: true` matches the fact that the new fetch path is always runnable.
4. **Behaviour change to call out:** the SMM-managed default upstream no longer falls back to the local SMM proxy in `getTVDBv4Client`; it now uses `fetchTvdb` (direct + discovered general reverse proxies). This is the intended simplification — the new design treats "default upstream" as a first-class direct-then-proxy flow instead of a local-proxy shortcut. The TvdbUtils test for the deprecated local-SMM-proxy default path is intentionally removed in Task 1, Step 4.
5. **Out-of-scope:** `searchTmdb` / `getMovieById` / `getTmdbPrimaryTranslations` / `getTmdbLanguages` / `getTvShowById` / `getSeason` already use `fetchTmdb` / `fetchTvdb` internally. `useScrapeNfoMutation` already routes through `useTmdbQueries` / `useTvdbQueries`. Neither is touched.
