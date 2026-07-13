# Asset Image Multi-Server Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let UI scrape / proxied image loads try official TMDB/TVDB CDN URLs first, then host-swap onto discover `tmdb-asset` / `tvdb-asset` mirrors, without changing `doDownloadImage` / `doDownloadImageAsFile`.

**Architecture:** Widen discover types so asset bases reach the UI. Add a pure `buildAssetUrlCandidates` helper, then thin wrappers that retry `downloadImageApi` and `/api/image` over that candidate list. Wire scrape/thumbnail/season-poster call sites and `useImage` to the wrappers.

**Tech Stack:** TypeScript, Vitest, existing `apiFetch` / discover / downloadImage UI APIs.

**Working directory for all commands:** `C:\Users\lawrence\workspace\smm_github`

**Design refs:**
- `docs/superpowers/specs/2026-07-13-asset-image-failover-design.md`

**Spec coverage check:**
- Discover `tmdb-asset` / `tvdb-asset` → Tasks 1–2
- `buildAssetUrlCandidates` host-swap + order → Task 3
- `downloadImageWithFailover` → Task 4
- `useImage` / proxied fetch failover → Task 5
- Call-site swaps → Task 6
- Unchanged core-routes → verified by non-touch + Task 7 smoke
- Unit tests listed in spec §4 → Tasks 3–4
- E2E skip relaxation → out of scope (optional follow-up; not required)

---

## File Map

**Create:**
- `apps/ui/src/lib/assetImageUrls.ts` — CDN host sets + `buildAssetUrlCandidates`
- `apps/ui/src/lib/assetImageUrls.test.ts`
- `apps/ui/src/api/downloadImageWithFailover.ts` — retry loop over `downloadImageApi`
- `apps/ui/src/api/downloadImageWithFailover.test.ts`
- `apps/ui/src/api/fetchProxiedImageWithFailover.ts` — retry loop over `GET /api/image?url=…`
- `apps/ui/src/api/fetchProxiedImageWithFailover.test.ts`

**Modify:**
- `apps/cli/src/route/discover.ts` — accept asset types in normalize
- `apps/cli/src/route/discover.test.ts` — assert asset entries survive
- `apps/ui/src/api/discover.ts` — widen `MediaDatabaseType` + Zod
- `apps/ui/src/api/discover.test.ts` — parse asset entries
- `apps/ui/src/hooks/useImage.ts` — use proxied failover helper
- `apps/ui/src/hooks/useScrapePosterMutation.ts` — use `downloadImageWithFailover`
- `apps/ui/src/hooks/useScrapeFanartMutation.ts` — same
- `apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts` — same
- `apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts` — same
- `apps/ui/src/lib/utils.ts` — `downloadSeasonPoster` same

**Untouched (out of scope):**
- `packages/core-routes/src/downloadImage.ts`
- `packages/core-routes/src/downloadImageAsFile.ts`
- Direct browser `<img src="https://image.tmdb.org/…">` call sites
- `apps/e2e/test/specs/tv/Scrape.e2e.ts` hard skip (optional later)

---

### Task 1: CLI discover accepts `tmdb-asset` / `tvdb-asset`

**Files:**
- Modify: `apps/cli/src/route/discover.ts`
- Modify: `apps/cli/src/route/discover.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/cli/src/route/discover.test.ts`, add inside `describe('handleDiscover', …)`:

```ts
  it('keeps tmdb-asset and tvdb-asset entries', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        mediaDatabases: [
          { type: 'tmdb', baseUrl: 'https://example.com/api/tmdb' },
          { type: 'tmdb-asset', baseUrl: 'https://tmdb-asset.example.com' },
          { type: 'tvdb-asset', url: 'https://tvdb-asset.example.com', authorizationMethod: 'none' },
          { type: 'unknown', baseUrl: 'https://drop.me' },
        ],
      }),
    );

    const res = await app.request('/api/discover');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([
      { type: 'tmdb', url: 'https://example.com/api/tmdb', authorizationMethod: 'none' },
      { type: 'tmdb-asset', url: 'https://tmdb-asset.example.com', authorizationMethod: 'none' },
      { type: 'tvdb-asset', url: 'https://tvdb-asset.example.com', authorizationMethod: 'none' },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C apps/cli exec vitest run src/route/discover.test.ts -t "keeps tmdb-asset"
```

Expected: FAIL because asset entries are dropped (or type mismatch).

- [ ] **Step 3: Implement minimal CLI normalize change**

In `apps/cli/src/route/discover.ts`:

1. Change type alias:

```ts
export type MediaDatabaseType = 'tmdb' | 'tvdb' | 'tmdb-asset' | 'tvdb-asset';
```

2. In `normalizeMediaDatabaseEntry`, replace the type guard:

```ts
  if (type !== 'tmdb' && type !== 'tvdb' && type !== 'tmdb-asset' && type !== 'tvdb-asset') {
    return null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm -C apps/cli exec vitest run src/route/discover.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/discover.ts apps/cli/src/route/discover.test.ts
git commit -m "$(cat <<'EOF'
feat(discover): keep tmdb-asset and tvdb-asset entries

EOF
)"
```

---

### Task 2: UI discover schema accepts asset types

**Files:**
- Modify: `apps/ui/src/api/discover.ts`
- Modify: `apps/ui/src/api/discover.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/ui/src/api/discover.test.ts`, add:

```ts
  it("parses tmdb-asset and tvdb-asset entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            mediaDatabases: [
              { type: "tmdb-asset", url: "https://tmdb-asset.example.com", authorizationMethod: "none" },
              { type: "tvdb-asset", url: "https://tvdb-asset.example.com", authorizationMethod: "date-token" },
            ],
          },
        }),
      }),
    );

    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([
      { type: "tmdb-asset", url: "https://tmdb-asset.example.com", authorizationMethod: "none" },
      { type: "tvdb-asset", url: "https://tvdb-asset.example.com", authorizationMethod: "date-token" },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -C apps/ui exec vitest run src/api/discover.test.ts -t "parses tmdb-asset"
```

Expected: FAIL (Zod rejects asset types → empty array, or assertion fails).

- [ ] **Step 3: Widen UI discover types + schema**

In `apps/ui/src/api/discover.ts`:

```ts
export type MediaDatabaseType = 'tmdb' | 'tvdb' | 'tmdb-asset' | 'tvdb-asset'
```

```ts
const endpointSchema = z.object({
  type: z.union([
    z.literal('tmdb'),
    z.literal('tvdb'),
    z.literal('tmdb-asset'),
    z.literal('tvdb-asset'),
  ]),
  url: z.string().min(1),
  authorizationMethod: z.union([z.literal('date-token'), z.literal('none')]),
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm -C apps/ui exec vitest run src/api/discover.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/api/discover.ts apps/ui/src/api/discover.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): parse discover tmdb-asset and tvdb-asset endpoints

EOF
)"
```

---

### Task 3: Pure candidate builder `buildAssetUrlCandidates`

**Files:**
- Create: `apps/ui/src/lib/assetImageUrls.ts`
- Create: `apps/ui/src/lib/assetImageUrls.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/ui/src/lib/assetImageUrls.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildAssetUrlCandidates } from "./assetImageUrls"
import type { DiscoverConfig } from "@/api/discover"

const emptyConfig: DiscoverConfig = { mediaDatabases: [], reverseProxies: [] }

const configWithAssets: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb", url: "https://api.example/tmdb", authorizationMethod: "none" },
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
    { type: "tmdb-asset", url: "https://tmdb-mirror-2.example/", authorizationMethod: "none" },
    { type: "tvdb-asset", url: "https://tvdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
}

describe("buildAssetUrlCandidates", () => {
  it("puts official TMDB URL first, then host-swapped tmdb-asset mirrors", () => {
    const url = "https://image.tmdb.org/t/p/original/poster.jpg"
    expect(buildAssetUrlCandidates(url, configWithAssets)).toEqual([
      "https://image.tmdb.org/t/p/original/poster.jpg",
      "https://tmdb-mirror.example/t/p/original/poster.jpg",
      "https://tmdb-mirror-2.example/t/p/original/poster.jpg",
    ])
  })

  it("puts official TVDB artwork URL first, then tvdb-asset mirrors", () => {
    const url =
      "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg"
    expect(buildAssetUrlCandidates(url, configWithAssets)).toEqual([
      "https://artworks.thetvdb.com/banners/v4/series/1/posters/abc.jpg",
      "https://tvdb-mirror.example/banners/v4/series/1/posters/abc.jpg",
    ])
  })

  it("normalizes protocol-relative URLs before building candidates", () => {
    const url = "//image.tmdb.org/t/p/w500/a.jpg"
    expect(buildAssetUrlCandidates(url, configWithAssets)[0]).toBe(
      "https://image.tmdb.org/t/p/w500/a.jpg",
    )
  })

  it("returns only the original URL for unknown hosts", () => {
    expect(
      buildAssetUrlCandidates("https://cdn.example.com/pic.jpg", configWithAssets),
    ).toEqual(["https://cdn.example.com/pic.jpg"])
  })

  it("returns only the original URL when discover has no matching assets", () => {
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", emptyConfig),
    ).toEqual(["https://image.tmdb.org/t/p/original/x.jpg"])
  })

  it("dedupes when a mirror origin matches the original host", () => {
    const config: DiscoverConfig = {
      mediaDatabases: [
        {
          type: "tmdb-asset",
          url: "https://image.tmdb.org",
          authorizationMethod: "none",
        },
      ],
      reverseProxies: [],
    }
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", config),
    ).toEqual(["https://image.tmdb.org/t/p/original/x.jpg"])
  })

  it("skips invalid asset base URLs", () => {
    const config: DiscoverConfig = {
      mediaDatabases: [
        { type: "tmdb-asset", url: "not a url", authorizationMethod: "none" },
        { type: "tmdb-asset", url: "https://good.example", authorizationMethod: "none" },
      ],
      reverseProxies: [],
    }
    expect(
      buildAssetUrlCandidates("https://image.tmdb.org/t/p/original/x.jpg", config),
    ).toEqual([
      "https://image.tmdb.org/t/p/original/x.jpg",
      "https://good.example/t/p/original/x.jpg",
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -C apps/ui exec vitest run src/lib/assetImageUrls.test.ts
```

Expected: FAIL — module / export missing.

- [ ] **Step 3: Implement `assetImageUrls.ts`**

Create `apps/ui/src/lib/assetImageUrls.ts`:

```ts
import type { DiscoverConfig, MediaDatabaseType } from "@/api/discover"

export const TMDB_IMAGE_HOSTS = new Set(["image.tmdb.org"])
export const TVDB_ARTWORK_HOSTS = new Set(["artworks.thetvdb.com"])

function normalizeImageUrl(url: string): string {
  if (url.startsWith("//")) return `https:${url}`
  return url
}

function hostSwap(originalUrl: string, assetBaseUrl: string): string | null {
  try {
    const original = new URL(originalUrl)
    const base = new URL(assetBaseUrl)
    const swapped = new URL(original.href)
    swapped.protocol = base.protocol
    swapped.host = base.host
    // Keep pathname/search/hash from the original CDN URL.
    // If asset base includes a path prefix, join it in front of original pathname.
    const basePath = base.pathname.replace(/\/$/, "")
    if (basePath && basePath !== "") {
      swapped.pathname = `${basePath}${original.pathname}`
    }
    return swapped.href
  } catch {
    return null
  }
}

function assetTypeForHost(hostname: string): MediaDatabaseType | null {
  if (TMDB_IMAGE_HOSTS.has(hostname)) return "tmdb-asset"
  if (TVDB_ARTWORK_HOSTS.has(hostname)) return "tvdb-asset"
  return null
}

/**
 * Build ordered image URL candidates: official CDN first, then discover asset mirrors (host-swap).
 */
export function buildAssetUrlCandidates(
  url: string,
  config: DiscoverConfig,
): string[] {
  const normalized = normalizeImageUrl(url)
  let hostname = ""
  try {
    hostname = new URL(normalized).hostname
  } catch {
    return [url]
  }

  const assetType = assetTypeForHost(hostname)
  const candidates: string[] = [normalized]
  if (!assetType) return candidates

  for (const entry of config.mediaDatabases) {
    if (entry.type !== assetType) continue
    const swapped = hostSwap(normalized, entry.url)
    if (!swapped) continue
    if (!candidates.includes(swapped)) candidates.push(swapped)
  }
  return candidates
}
```

Note: if asset bases are always origin-only (no path prefix), `basePath` joining is harmless (`""`). Keep it for bases that include a path.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm -C apps/ui exec vitest run src/lib/assetImageUrls.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/assetImageUrls.ts apps/ui/src/lib/assetImageUrls.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): build TMDB/TVDB asset image URL candidates

EOF
)"
```

---

### Task 4: `downloadImageWithFailover`

**Files:**
- Create: `apps/ui/src/api/downloadImageWithFailover.ts`
- Create: `apps/ui/src/api/downloadImageWithFailover.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/ui/src/api/downloadImageWithFailover.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { ExistedFileError, existedFileError } from "@core/errors"
import type { DiscoverConfig } from "./discover"
import type { DownloadImageResponseBody } from "@core/types"

const config: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
}

describe("downloadImageWithFailover", () => {
  it("returns first success without trying later candidates", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({ data: { url: "ok", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result).toEqual({ data: { url: "ok", path: "/p" } })
    expect(downloadImageApi).toHaveBeenCalledTimes(1)
    expect(downloadImageApi).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
    )
  })

  it("fails over to mirror when official returns an error", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 503",
      })
      .mockResolvedValueOnce({ data: { url: "b", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error).toBeUndefined()
    expect(downloadImageApi).toHaveBeenCalledTimes(2)
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      2,
      "https://tmdb-mirror.example/t/p/original/a.jpg",
      "/media/poster.jpg",
    )
  })

  it("stops on ExistedFileError without trying mirrors", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: existedFileError("/p"),
      })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error?.startsWith(`${ExistedFileError}:`)).toBe(true)
    expect(downloadImageApi).toHaveBeenCalledTimes(1)
  })

  it("returns last error when all candidates fail", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValue({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 500",
      })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error).toBe("HTTP error! status: 500")
    expect(downloadImageApi).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -C apps/ui exec vitest run src/api/downloadImageWithFailover.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement wrapper**

Create `apps/ui/src/api/downloadImageWithFailover.ts`:

```ts
import { isError, ExistedFileError } from "@core/errors"
import type { DownloadImageResponseBody } from "@core/types"
import { buildAssetUrlCandidates } from "@/lib/assetImageUrls"
import { fetchDiscoverConfig, type DiscoverConfig } from "./discover"
import { downloadImageApi as defaultDownloadImageApi } from "./downloadImage"

export interface DownloadImageWithFailoverDeps {
  fetchDiscoverConfig?: () => Promise<DiscoverConfig>
  downloadImageApi?: (url: string, pathInPosix: string) => Promise<DownloadImageResponseBody>
}

export async function downloadImageWithFailover(
  url: string,
  pathInPosix: string,
  deps: DownloadImageWithFailoverDeps = {},
): Promise<DownloadImageResponseBody> {
  const fetchConfig = deps.fetchDiscoverConfig ?? fetchDiscoverConfig
  const download = deps.downloadImageApi ?? defaultDownloadImageApi

  const config = await fetchConfig()
  const candidates = buildAssetUrlCandidates(url, config)

  let last: DownloadImageResponseBody | undefined
  for (const candidate of candidates) {
    const response = await download(candidate, pathInPosix)
    last = response
    if (!response.error) return response
    if (isError(response.error, ExistedFileError)) return response
  }

  return (
    last ?? {
      data: { url, path: pathInPosix },
      error: "Failed to download image: no candidates",
    }
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm -C apps/ui exec vitest run src/api/downloadImageWithFailover.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/api/downloadImageWithFailover.ts apps/ui/src/api/downloadImageWithFailover.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): download images with asset URL failover

EOF
)"
```

---

### Task 5: Proxied `/api/image` failover for `useImage`

**Files:**
- Create: `apps/ui/src/api/fetchProxiedImageWithFailover.ts`
- Create: `apps/ui/src/api/fetchProxiedImageWithFailover.test.ts`
- Modify: `apps/ui/src/hooks/useImage.ts`

- [ ] **Step 1: Write failing tests for the helper**

Create `apps/ui/src/api/fetchProxiedImageWithFailover.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import type { DiscoverConfig } from "./discover"

const config: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
}

describe("fetchProxiedImageWithFailover", () => {
  it("tries mirror after official /api/image fails", async () => {
    const fetchImpl = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "err" } as Response)
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["img"], { type: "image/jpeg" }),
      } as Response)

    const { fetchProxiedImageWithFailover } = await import("./fetchProxiedImageWithFailover")
    const blob = await fetchProxiedImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      {
        fetchDiscoverConfig: async () => config,
        fetchImpl,
      },
    )

    expect(await blob.text()).toBe("img")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      encodeURIComponent("https://image.tmdb.org/t/p/original/a.jpg"),
    )
    expect(String(fetchImpl.mock.calls[1]![0])).toContain(
      encodeURIComponent("https://tmdb-mirror.example/t/p/original/a.jpg"),
    )
  })

  it("rethrows AbortError without trying further candidates", async () => {
    const abortError = new DOMException("Aborted", "AbortError")
    const fetchImpl = vi.fn().mockRejectedValue(abortError)

    const { fetchProxiedImageWithFailover } = await import("./fetchProxiedImageWithFailover")
    await expect(
      fetchProxiedImageWithFailover("https://image.tmdb.org/t/p/original/a.jpg", {
        fetchDiscoverConfig: async () => config,
        fetchImpl,
        signal: AbortSignal.abort(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -C apps/ui exec vitest run src/api/fetchProxiedImageWithFailover.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement helper**

Create `apps/ui/src/api/fetchProxiedImageWithFailover.ts`:

```ts
import { buildAssetUrlCandidates } from "@/lib/assetImageUrls"
import { fetchDiscoverConfig, type DiscoverConfig } from "./discover"

export interface FetchProxiedImageWithFailoverDeps {
  fetchDiscoverConfig?: () => Promise<DiscoverConfig>
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  signal?: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

export async function fetchProxiedImageWithFailover(
  imageUrl: string,
  deps: FetchProxiedImageWithFailoverDeps = {},
): Promise<Blob> {
  const fetchConfig = deps.fetchDiscoverConfig ?? fetchDiscoverConfig
  const fetchImpl = deps.fetchImpl ?? fetch
  const config = await fetchConfig()
  const candidates = buildAssetUrlCandidates(imageUrl, config)

  let lastError: unknown
  for (const candidate of candidates) {
    const apiUrl = `/api/image?url=${encodeURIComponent(candidate)}`
    try {
      const response = await fetchImpl(apiUrl, { signal: deps.signal })
      if (!response.ok) {
        lastError = new Error(`Failed to download image: ${response.statusText}`)
        continue
      }
      return await response.blob()
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to download image: ${String(lastError)}`)
}
```

- [ ] **Step 4: Wire `useImage.ts`**

Replace the single `/api/image` fetch path for http(s)/protocol-relative URLs with:

```ts
import { fetchProxiedImageWithFailover } from "@/api/fetchProxiedImageWithFailover"

// inside the effect, after normalizing imageUrl:
fetchProxiedImageWithFailover(imageUrl, { signal: abortController.signal })
  .then(async (blob) => {
    const base64data = await convertBlobToBase64(blob)
    setImageData(base64data)
  })
  .catch((error) => {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return
    }
    console.error(`[useImage] Error downloading image from ${imageUrl}:`, error)
    setImageData(placeholder)
  })
```

Keep `data:` and `file://` behavior unchanged. For `file://`, continue using a single `/api/image?url=…` call (no discover candidates) — either call `fetchProxiedImageWithFailover` (candidate list will be length 1) or keep the old path for file only. Prefer calling the helper for both http(s) and file so one code path remains.

- [ ] **Step 5: Run helper tests + a quick useImage sanity check if a test file exists**

```bash
pnpm -C apps/ui exec vitest run src/api/fetchProxiedImageWithFailover.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/api/fetchProxiedImageWithFailover.ts apps/ui/src/api/fetchProxiedImageWithFailover.test.ts apps/ui/src/hooks/useImage.ts
git commit -m "$(cat <<'EOF'
feat(ui): failover proxied image loads via asset mirrors

EOF
)"
```

---

### Task 6: Swap scrape / thumbnail / season-poster call sites

**Files:**
- Modify: `apps/ui/src/hooks/useScrapePosterMutation.ts`
- Modify: `apps/ui/src/hooks/useScrapeFanartMutation.ts`
- Modify: `apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts`
- Modify: `apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts`
- Modify: `apps/ui/src/lib/utils.ts` (`downloadSeasonPoster`)

- [ ] **Step 1: Replace imports and calls**

In each file:

1. Change:

```ts
import { downloadImageApi } from "@/api/downloadImage"
```

to:

```ts
import { downloadImageWithFailover } from "@/api/downloadImageWithFailover"
```

2. Replace every `downloadImageApi(` with `downloadImageWithFailover(`.

Do not change argument order (`url`, `path`).

- [ ] **Step 2: Run related unit tests**

```bash
pnpm -C apps/ui exec vitest run \
  src/hooks/useScrapePosterMutation.test.ts \
  src/hooks/useScrapeFanartMutation.test.ts \
  src/hooks/useHandleScrapeStart.test.ts
```

Expected: PASS (hooks that mock deeper layers should be unaffected; if a test mocks `@/api/downloadImage`, update the mock path to `@/api/downloadImageWithFailover`).

- [ ] **Step 3: Commit**

```bash
git add \
  apps/ui/src/hooks/useScrapePosterMutation.ts \
  apps/ui/src/hooks/useScrapeFanartMutation.ts \
  apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts \
  apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts \
  apps/ui/src/lib/utils.ts
git commit -m "$(cat <<'EOF'
feat(ui): use asset image failover for scrape downloads

EOF
)"
```

---

### Task 7: Verification

- [ ] **Step 1: Run focused unit suites**

```bash
pnpm -C apps/cli exec vitest run src/route/discover.test.ts
pnpm -C apps/ui exec vitest run \
  src/api/discover.test.ts \
  src/lib/assetImageUrls.test.ts \
  src/api/downloadImageWithFailover.test.ts \
  src/api/fetchProxiedImageWithFailover.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Confirm core-routes download files are untouched**

```bash
git diff --name-only HEAD~10 -- packages/core-routes/src/downloadImage.ts packages/core-routes/src/downloadImageAsFile.ts
```

Expected: empty output (no changes in this branch’s feature commits; adjust `HEAD~N` if needed, or compare against the design commit).

- [ ] **Step 3: Optional manual / e2e smoke**

```bash
bun ci/run-e2e-test.ts --spec ./test/specs/tv/Scrape.e2e.ts
```

Expected: pass when official CDN is reachable; skip behavior unchanged when the existing TVDB probe fails (mirror-aware skip is a follow-up).

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Discover keeps asset types (CLI) | Task 1 |
| UI parses asset types | Task 2 |
| Host-swap candidates, official first | Task 3 |
| `downloadImageWithFailover` + ExistedFile / last error | Task 4 |
| `useImage` via `/api/image` failover | Task 5 |
| Scrape/thumbnail/season poster call sites | Task 6 |
| core-routes unchanged | Task 7 + File Map Untouched |
| Unit tests for builder + wrapper | Tasks 3–4 |
| E2E skip relaxation | Explicitly out of scope |
