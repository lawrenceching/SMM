# Searchbox → General Reverse Proxies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** Implemented 2026-07-09 (inline execution). Related UI tests: 95 passed.

**Goal:** Migrate `MediaDatabaseSearchbox` from dedicated `mediaDatabases` direct URLs to a local-first then remote OpenResty `reverseProxies` list, with one shared `preferReverseProxyBaseUrl`.

**Architecture:** Introduce a dual-protocol header builder (`local` = `X-SMM-Proxy-Upstream-BaseURL`; `openresty` = `X-Upstream-Base-Url` + optional `X-Proxy-Authorization` with UTC `yyyyMMdd`). Discovery probes only `reverseProxies`. Searchbox iterates candidates: local hello proxy → preferred remote → other remotes. Upstream stays SMM-managed `…/api/tmdb` and `…/api/tvdb`.

**Tech Stack:** React 19, TypeScript, Vitest, existing `/api/discover` (`apps/cli` + `apps/ui/src/api/discover.ts`).

**Working directory for all commands:** `C:\Users\lawrence\workspace\smm_github`

**Design refs:**
- `.agents/docs/design/searchbox-reverse-proxies/context.md`
- `.agents/docs/design/searchbox-reverse-proxies/design.md`
- `reverse-proxy-readme.md`

---

## File Map

**Create:**
- `apps/ui/src/lib/proxyRequestHeaders.ts` — build headers for `local` | `openresty`
- `apps/ui/src/lib/proxyRequestHeaders.test.ts`
- `apps/ui/src/lib/openrestyDateToken.ts` — UTC `yyyyMMdd` (±1 day helpers if needed for tests)
- `apps/ui/src/lib/openrestyDateToken.test.ts`
- `apps/ui/src/lib/reverseProxyServiceDiscovery.ts` — replace media-database discovery for remotes
- `apps/ui/src/lib/reverseProxyServiceDiscovery.test.ts`
- `apps/ui/src/hooks/useReverseProxyBaseUrls.ts`
- `apps/ui/src/hooks/useReverseProxyBaseUrls.test.ts`

**Modify:**
- `apps/ui/src/lib/localStorages.ts` — add `preferReverseProxyBaseUrl`; deprecate/remove old prefer keys
- `apps/ui/src/lib/mediaDatabaseReachability.ts` — probe OpenResty-shaped requests (or new `reverseProxyReachability.ts`)
- `apps/ui/src/api/tmdb.ts` — accept proxy `kind` / OpenResty headers for Searchbox path (or thin wrapper used only by Searchbox)
- `apps/ui/src/lib/TvdbUtils.ts` — same for TVDB client `fetchImpl` when Searchbox passes OpenResty candidate
- `apps/ui/src/components/MediaDatabaseSearchbox.tsx` — use `useReverseProxyBaseUrls`, drop direct search
- `apps/ui/src/main.tsx` — call `startReverseProxyServiceDiscovery`
- `docs/superpowers/design/media-database.md` — §3 discovery section
- `.agents/docs/design/searchbox-reverse-proxies/design.md` — mark checklist items done as work proceeds

**Delete (after Searchbox no longer imports them):**
- `apps/ui/src/api/tmdbDirect.ts` + `tmdbDirect.test.ts`
- `apps/ui/src/lib/TvdbDirectSearch.ts` + `TvdbDirectSearch.test.ts`
- `apps/ui/src/hooks/useMediaDatabaseBaseUrls.ts` + test (once replaced)
- `apps/ui/src/lib/mediaDatabaseServiceDiscovery.ts` + test (once replaced)
- Or keep thin re-exports temporarily — prefer delete if no other callers

**Untouched (out of scope):**
- `useTmdbQueries` / `useTvdbQueries` / scrape / AI / `useDatabaseConnectionStatus` (local proxy only)
- CLI `discover.ts` (already returns `reverseProxies`)

---

## Pre-flight

- [ ] **Step 1: Baseline tests**

```bash
pnpm -C apps/ui exec vitest run src/lib/mediaDatabaseServiceDiscovery.test.ts src/hooks/useMediaDatabaseBaseUrls.test.ts src/api/discover.test.ts src/components/MediaDatabaseSearchbox.test.tsx
```

Expected: all pass. Note counts for regression comparison.

---

## Task 1: UTC OpenResty date-token helper

**Files:**
- Create: `apps/ui/src/lib/openrestyDateToken.ts`
- Create: `apps/ui/src/lib/openrestyDateToken.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest"
import { openrestyDateToken } from "./openrestyDateToken"

describe("openrestyDateToken", () => {
  it("formats UTC date as yyyyMMdd", () => {
    // 2024-05-07T15:00:00Z → 20240507
    expect(openrestyDateToken(new Date("2024-05-07T15:00:00.000Z"))).toBe("20240507")
  })

  it("uses UTC not local calendar day near midnight", () => {
    // If local were UTC+8, local date might be May 8; token must stay May 7 UTC
    expect(openrestyDateToken(new Date("2024-05-07T20:00:00.000Z"))).toBe("20240507")
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm -C apps/ui exec vitest run src/lib/openrestyDateToken.test.ts
```

- [ ] **Step 3: Implement**

```ts
/**
 * OpenResty AUTH_METHOD=date-token: UTC calendar day as yyyyMMdd.
 * @see reverse-proxy-readme.md
 */
export function openrestyDateToken(now: Date = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `${y}${m}${d}`
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add apps/ui/src/lib/openrestyDateToken.ts apps/ui/src/lib/openrestyDateToken.test.ts
git commit -m "feat(ui): add OpenResty UTC yyyyMMdd date-token helper"
```

---

## Task 2: Dual-protocol proxy request headers

**Files:**
- Create: `apps/ui/src/lib/proxyRequestHeaders.ts`
- Create: `apps/ui/src/lib/proxyRequestHeaders.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest"
import { buildProxyRequestHeaders } from "./proxyRequestHeaders"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

describe("buildProxyRequestHeaders", () => {
  it("builds local SMM headers without proxy auth", () => {
    expect(
      buildProxyRequestHeaders({
        kind: "local",
        upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tmdb",
        authorizationMethod: "none",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-SMM-Proxy-Upstream-BaseURL": "https://tmdb-mcp-server.imlc.me/api/tmdb",
    })
  })

  it("builds openresty headers with X-Upstream-Base-Url and date-token", () => {
    expect(
      buildProxyRequestHeaders({
        kind: "openresty",
        upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tmdb",
        authorizationMethod: "date-token",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-Upstream-Base-Url": "https://tmdb-mcp-server.imlc.me/api/tmdb",
      "X-Proxy-Authorization": "Bearer 20240507",
    })
  })

  it("omits X-Proxy-Authorization when openresty auth is none", () => {
    const h = buildProxyRequestHeaders({
      kind: "openresty",
      upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tvdb",
      authorizationMethod: "none",
    })
    expect(h["X-Proxy-Authorization"]).toBeUndefined()
    expect(h["X-Upstream-Base-Url"]).toBe("https://tmdb-mcp-server.imlc.me/api/tvdb")
  })

  it("never sets Authorization for openresty date-token", () => {
    const h = buildProxyRequestHeaders({
      kind: "openresty",
      upstreamBaseURL: "https://example.com",
      authorizationMethod: "date-token",
    })
    expect(h.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm -C apps/ui exec vitest run src/lib/proxyRequestHeaders.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { openrestyDateToken } from "./openrestyDateToken"

export type ProxyKind = "local" | "openresty"
export type ProxyAuthorizationMethod = "date-token" | "none"

export interface BuildProxyRequestHeadersInput {
  kind: ProxyKind
  upstreamBaseURL: string
  authorizationMethod: ProxyAuthorizationMethod
  /** Optional extra headers (e.g. upstream API key on Authorization) */
  extra?: Record<string, string>
}

export function buildProxyRequestHeaders(
  input: BuildProxyRequestHeadersInput,
): Record<string, string> {
  const upstream = input.upstreamBaseURL.replace(/\/+$/, "")
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(input.extra ?? {}),
  }

  if (input.kind === "local") {
    headers["X-SMM-Proxy-Upstream-BaseURL"] = upstream
    return headers
  }

  headers["X-Upstream-Base-Url"] = upstream
  if (input.authorizationMethod === "date-token") {
    headers["X-Proxy-Authorization"] = `Bearer ${openrestyDateToken()}`
  }
  return headers
}
```

- [ ] **Step 4: Run — expect PASS**

---

## Task 3: `preferReverseProxyBaseUrl` in localStorages

**Files:**
- Modify: `apps/ui/src/lib/localStorages.ts`

- [ ] **Step 1: Add storage key and accessors**

Add:

```ts
const STORAGE_KEY_PREFER_REVERSE_PROXY_BASE_URL = "preferReverseProxyBaseUrl"
```

Mirror the existing preferTmdb/Tvdb getter/setter pattern for `preferReverseProxyBaseUrl`.

Keep `preferTmdbBaseUrl` / `preferTvdbBaseUrl` until Task 5 migration + Task 8 cleanup (or mark deprecated in comments).

- [ ] **Step 2: Add a small unit test file or extend an existing localStorages test if present**

If no dedicated test file exists, cover via discovery tests in Task 5 (migration reads/writes).

---

## Task 4: Reachability probe for OpenResty proxies

**Files:**
- Create: `apps/ui/src/lib/reverseProxyReachability.ts` (preferred over overloading `mediaDatabaseReachability` types)
- Create: `apps/ui/src/lib/reverseProxyReachability.test.ts`

Probe design (match real Searchbox traffic):

```ts
// GET `${proxy.url}/search/tv?query=__probe__&language=en-US&source=latencytest-N`
// Headers from buildProxyRequestHeaders({ kind: 'openresty', upstreamBaseURL: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod })
```

Any HTTP response = reachable (same rule as current `probeEndpointReachability`).

- [ ] **Step 1: Failing tests** — assert URL path, `X-Upstream-Base-Url`, `X-Proxy-Authorization` when date-token, and `?source=latencytest-N` tagging helper if kept in discovery layer.

- [ ] **Step 2: Implement probe + `REACHABILITY_PROBES_PER_URL = 3`**

- [ ] **Step 3: Tests PASS**

---

## Task 5: `reverseProxyServiceDiscovery`

**Files:**
- Create: `apps/ui/src/lib/reverseProxyServiceDiscovery.ts`
- Create: `apps/ui/src/lib/reverseProxyServiceDiscovery.test.ts`
- Modify: `apps/ui/src/main.tsx`

Behavior:

1. `fetchDiscoverConfig()` → use `reverseProxies` only for probing.
2. Probe all remotes in parallel (3 probes each); pick fastest; write `preferReverseProxyBaseUrl` as `{ id, url, authorizationMethod }`.
3. Cache list in module state; `getDiscoveredReverseProxies()` / `subscribeToDiscovery()`.
4. Migration: if `preferReverseProxyBaseUrl` empty, and old prefer keys exist, if old URL equals a discovered reverse proxy URL, copy that entry; then remove old keys.
5. Idempotent per session (same guard pattern as current discovery).
6. Never throw to callers.

- [ ] **Step 1: Port tests from `mediaDatabaseServiceDiscovery.test.ts`**, rewrite mocks to `fetchDiscoverConfig` / `reverseProxies`, assert single prefer key.

Example expectation:

```ts
expect(JSON.parse(localStorages.preferReverseProxyBaseUrl!)).toEqual({
  id: "gz1",
  url: "https://proxy.example.com",
  authorizationMethod: "date-token",
})
expect(localStorages.preferTmdbBaseUrl).toBeNull()
expect(localStorages.preferTvdbBaseUrl).toBeNull()
```

- [ ] **Step 2: Implement + wire `main.tsx`**

```ts
import { startReverseProxyServiceDiscovery } from "./lib/reverseProxyServiceDiscovery"
// ...
void startReverseProxyServiceDiscovery()
```

Leave old `startMediaDatabaseServiceDiscovery` unused until deleted in Task 8.

- [ ] **Step 3: Tests PASS**

```bash
pnpm -C apps/ui exec vitest run src/lib/reverseProxyServiceDiscovery.test.ts
```

---

## Task 6: `useReverseProxyBaseUrls`

**Files:**
- Create: `apps/ui/src/hooks/useReverseProxyBaseUrls.ts`
- Create: `apps/ui/src/hooks/useReverseProxyBaseUrls.test.ts`

```ts
export interface ReverseProxyCandidate {
  id: string
  kind: "local" | "openresty"
  url: string
  authorizationMethod: "date-token" | "none"
}

/**
 * Order:
 * 1. local appConfig.reverseProxyUrl (kind local) when non-empty
 * 2. preferReverseProxyBaseUrl if it matches a discovered remote (or still include preferred even if not in list)
 * 3. other discovered reverseProxies
 */
export function useReverseProxyBaseUrls(): ReverseProxyCandidate[]
```

Hook must read `useConfig().appConfig.reverseProxyUrl` for local entry.

- [ ] **Step 1: Failing tests** — local first; preferred second; dedupe by URL; empty local omitted; no HTTP from hook.

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS**

```bash
pnpm -C apps/ui exec vitest run src/hooks/useReverseProxyBaseUrls.test.ts
```

---

## Task 7: Searchbox + search via proxy candidates

**Files:**
- Modify: `apps/ui/src/api/tmdb.ts` (and/or add `searchTmdbViaProxy` in a small module that uses `buildProxyRequestHeaders`)
- Modify: `apps/ui/src/lib/TvdbUtils.ts` or add Searchbox-only search helper using `fetch` + OpenResty/local headers
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.tsx`
- Modify: `apps/ui/src/components/MediaDatabaseSearchbox.test.tsx` (mock `useReverseProxyBaseUrls`)

**Searchbox loop (TMDB):**

```ts
const proxies = useReverseProxyBaseUrls()
for (const proxy of proxies) {
  try {
    const response = await searchTmdb(query, mediaType, searchLanguage, {
      reverseProxyUrl: proxy.url,
      upstreamBaseURL: SMM_TMDB_DEFAULT_UPSTREAM,
      proxyKind: proxy.kind,
      authorizationMethod: proxy.authorizationMethod,
    })
    // handle results / empty → continue
  } catch { /* continue */ }
}
```

**`searchTmdb` / TVDB client changes:**

- Extend options with `proxyKind?: 'local' | 'openresty'` (default `'local'` for existing callers).
- When building headers, call `buildProxyRequestHeaders` instead of hardcoding only `X-SMM-Proxy-Upstream-BaseURL`.
- For `openresty` + `date-token`, do **not** put token on `Authorization`.
- Existing callers that only pass `reverseProxyUrl` keep working (`kind: local`).

TVDB: update `buildTvdbClient` `fetchImpl` to set the correct upstream header based on `proxyKind`, and set `X-Proxy-Authorization` when needed.

- [ ] **Step 1: Unit tests for tmdb header behavior with `proxyKind: 'openresty'`**

- [ ] **Step 2: Update Searchbox to single `useReverseProxyBaseUrls()` list for both TMDB and TVDB**

- [ ] **Step 3: Update Searchbox tests mocks**

```ts
vi.mock("@/hooks/useReverseProxyBaseUrls", () => ({
  useReverseProxyBaseUrls: vi.fn(() => []),
}))
```

- [ ] **Step 4: Run**

```bash
pnpm -C apps/ui exec vitest run src/api/tmdb.test.ts src/lib/TvdbUtils.test.ts src/components/MediaDatabaseSearchbox.test.tsx
```

Expected: PASS

---

## Task 8: Delete dead direct-path code + docs

**Files:**
- Delete: `tmdbDirect*`, `TvdbDirectSearch*`, old discovery/hook if unused
- Modify: `docs/superpowers/design/media-database.md` §3
- Modify: `.agents/docs/design/searchbox-reverse-proxies/design.md` checklist → `[x]`

Doc §3 should describe:

```
main.tsx → startReverseProxyServiceDiscovery
  → reverseProxies + OpenResty probe
  → preferReverseProxyBaseUrl

Searchbox → useReverseProxyBaseUrls
  → local first, then remotes
  → X-SMM-* vs X-Upstream-* / X-Proxy-Authorization
```

- [ ] **Step 1: Grep for leftover imports**

```bash
rg "useMediaDatabaseBaseUrls|searchTmdbDirect|searchTvdbDirect|startMediaDatabaseServiceDiscovery|preferTmdbBaseUrl|preferTvdbBaseUrl" apps/ui
```

Expected: no production references (tests for deleted modules gone).

- [ ] **Step 2: Full related test run**

```bash
pnpm -C apps/ui exec vitest run src/lib/openrestyDateToken.test.ts src/lib/proxyRequestHeaders.test.ts src/lib/reverseProxyReachability.test.ts src/lib/reverseProxyServiceDiscovery.test.ts src/hooks/useReverseProxyBaseUrls.test.ts src/api/tmdb.test.ts src/components/MediaDatabaseSearchbox.test.tsx
```

- [ ] **Step 3: Update design checklist in `.agents/docs/design/searchbox-reverse-proxies/design.md`**

---

## Spec coverage (self-review)

| Requirement | Task |
|-------------|------|
| Local proxy first | Task 6–7 |
| Then remote reverseProxies | Task 5–7 |
| OpenResty headers + UTC date-token | Task 1–2, 7 |
| Upstream = SMM-managed | Task 4, 7 |
| `preferReverseProxyBaseUrl` replaces per-DB prefers | Task 3, 5, 8 |
| Remove direct mediaDatabases Searchbox path | Task 7–8 |
| Dual protocol without breaking existing local callers | Task 7 default `proxyKind: 'local'` |

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-07-09-searchbox-reverse-proxies.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
