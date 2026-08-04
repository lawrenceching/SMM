# ScrapeDialog 图片下载走 HTTP 代理 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当用户为 TMDB/TVDB 配置了「自定义 host + httpProxy」时，让 ScrapeDialog 的 poster / fanart / 剧集缩略图下载走该代理。

**Architecture:** 前端三个 Scrape mutation 用纯函数 `resolveScrapeHttpProxy(mediaMetadata, userConfig)` 判定代理（镜像 `fetchTmdb`/`fetchTvdb` 的规则：host 非空可解析 && httpProxy 非空），把 `httpProxy` 透传到 `downloadImageWithFailover` → `downloadImageApi` → `POST /api/downloadImage` 请求体；CLI 的 `/api/downloadImage` 路由在有 `body.httpProxy` 时用 `createProxiedFetch` 作为 `fetchImpl` 转发，`doDownloadImageAsFile` 零改动。

**Tech Stack:** React 19 + TanStack Query (UI), Bun + Hono (CLI), Zod, Vitest, `@smm/core-routes` (createProxiedFetch)。

**设计文档:** `docs/superpowers/specs/2026-08-04-scrapedialog-proxy-download-design.md`（已提交，作为 golden source）。

> **Status:** 进行中 — Task 1-3 已完成（`DownloadImageRequestBody.httpProxy` + `downloadImageApi` 透传 + `downloadImageWithFailover` 透传，2026-08-04/08-05）。Task 4-7 待实现。

---

## File Structure

| 文件 | 职责 | 改动 |
|------|------|------|
| `packages/core/types.ts` | `DownloadImageRequestBody` 共享类型 | 新增可选 `httpProxy?: string` |
| `apps/ui/src/api/downloadImage.ts` | 图片下载 API 调用 | `downloadImageApi` 接受可选 `httpProxy`，非空时写入 body |
| `apps/ui/src/api/downloadImageWithFailover.ts` | 多候选下载（官方 CDN + discover 镜像） | deps 新增可选 `httpProxy`，透传给每个候选 |
| `apps/ui/src/lib/mediaDatabaseAccess.ts` | 媒体库访问辅助 | 新增 `resolveMediaDatabaseHttpProxy`、`resolveScrapeHttpProxy` 两个纯函数 |
| `apps/ui/src/lib/downloadScrapeImage.ts` | Scrape 图片下载（解析代理 + 下载 + 失败抛错） | 新增 |
| `apps/ui/src/hooks/useScrapePosterMutation.ts` | poster 任务 | 用 `downloadScrapeImage` 替换内联下载 |
| `apps/ui/src/hooks/useScrapeFanartMutation.ts` | fanart 任务 | 用 `downloadScrapeImage` 替换内联下载 |
| `apps/ui/src/hooks/useScrapeThumbnailMutation.ts` | 缩略图任务 | 解析代理并传给 TMDB/TVDB 变体 hooks |
| `apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts` | TMDB 剧集缩略图 | variables 新增 `httpProxy`，透传给下载 |
| `apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts` | TVDB 剧集缩略图 | variables 新增 `httpProxy`，透传给下载 |
| `apps/cli/src/route/DownloadImageAsFile.ts` | `/api/downloadImage` 路由 | `body.httpProxy` 时用 `createProxiedFetch` 作为 `fetchImpl` |

非目标（保持直连）：`useImage`/`GET /api/image`、nfo 任务、季海报 `lib/utils.ts`、`@smm/core-routes` 的 `doDownloadImageAsFile`。

测试命令约定：
- UI 单文件：`cd apps/ui && pnpm vitest run <path>`
- CLI 单文件：`cd apps/cli && pnpm vitest run <path>`
- 类型检查：`cd apps/ui && pnpm typecheck` / `cd apps/cli && pnpm typecheck`

---

## Task 1: `DownloadImageRequestBody` + `downloadImageApi` 支持 `httpProxy`

**Files:**
- Modify: `packages/core/types.ts`（`DownloadImageRequestBody`）
- Modify: `apps/ui/src/api/downloadImage.ts`
- Test: `apps/ui/src/api/downloadImage.test.ts`（新增）

- [x] **Step 1: 写失败测试**

创建 `apps/ui/src/api/downloadImage.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadImageApi } from "./downloadImage";

describe("downloadImageApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes httpProxy in the request body when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://image.tmdb.org/x.jpg", path: "/p/x.jpg" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg", "http://proxy:8080");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.url).toBe("https://image.tmdb.org/x.jpg");
    expect(body.httpProxy).toBe("http://proxy:8080");
    expect(typeof body.path).toBe("string");
  });

  it("omits httpProxy when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://image.tmdb.org/x.jpg", path: "/p/x.jpg" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadImageApi("https://image.tmdb.org/x.jpg", "/p/x.jpg");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("httpProxy");
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run: `cd apps/ui && pnpm vitest run src/api/downloadImage.test.ts`
Expected: FAIL — `body.httpProxy` 为 `undefined` / `not.toHaveProperty` 通过但第一个用例断言失败（当前函数不接受第三个参数）。

- [x] **Step 3: 实现**

修改 `packages/core/types.ts`，`DownloadImageRequestBody`：

```ts
export interface DownloadImageRequestBody {
  url: string
  /**
   * The absolute path in platform format
   */
  path: string
  /**
   * Optional outbound HTTP proxy (e.g. http://127.0.0.1:8081). Set by the UI
   * only for user-configured custom TMDB/TVDB hosts.
   */
  httpProxy?: string
}
```

修改 `apps/ui/src/api/downloadImage.ts`：

```ts
export async function downloadImageApi(
  url: string,
  pathInPosix: string,
  httpProxy?: string,
): Promise<DownloadImageResponseBody> {
  const req: DownloadImageRequestBody = {
    url: url,
    path: Path.toPlatformPath(pathInPosix),
    ...(httpProxy?.trim() ? { httpProxy: httpProxy.trim() } : {}),
  }
  const resp = await apiFetch('/api/downloadImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  return (await resp.json()) as DownloadImageResponseBody;
}
```

- [x] **Step 4: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/api/downloadImage.test.ts`
Expected: PASS（2 个用例）

- [x] **Step 5: 提交**

```bash
git add packages/core/types.ts apps/ui/src/api/downloadImage.ts apps/ui/src/api/downloadImage.test.ts
git commit -m "feat(downloadImage): accept optional httpProxy in request body"
```

---

## Task 2: `downloadImageWithFailover` 透传 `httpProxy`

**Files:**
- Modify: `apps/ui/src/api/downloadImageWithFailover.ts`
- Test: `apps/ui/src/api/downloadImageWithFailover.test.ts`

- [x] **Step 1: 写失败测试**

在 `apps/ui/src/api/downloadImageWithFailover.test.ts` 末尾（`describe` 块内）追加：

```ts
  it("passes httpProxy to downloadImageApi for every candidate", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string, httpProxy?: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 503",
      })
      .mockResolvedValue({ data: { url: "b", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
        httpProxy: "http://proxy:8080",
      },
    )

    expect(result.error).toBeUndefined()
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      1,
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      "http://proxy:8080",
    )
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      2,
      "https://tmdb-mirror.example/t/p/original/a.jpg",
      "/media/poster.jpg",
      "http://proxy:8080",
    )
  })
```

- [x] **Step 2: 运行测试确认失败**

Run: `cd apps/ui && pnpm vitest run src/api/downloadImageWithFailover.test.ts`
Expected: FAIL — 新增用例断言第三个参数为 `undefined`。

- [x] **Step 3: 实现**

修改 `apps/ui/src/api/downloadImageWithFailover.ts`：

```ts
export interface DownloadImageWithFailoverDeps {
  fetchDiscoverConfig?: () => Promise<DiscoverConfig>
  downloadImageApi?: (url: string, pathInPosix: string, httpProxy?: string) => Promise<DownloadImageResponseBody>
  httpProxy?: string
}

export async function downloadImageWithFailover(
  url: string,
  pathInPosix: string,
  deps: DownloadImageWithFailoverDeps = {},
): Promise<DownloadImageResponseBody> {
  const fetchConfig = deps.fetchDiscoverConfig ?? fetchDiscoverConfig
  const download = deps.downloadImageApi ?? defaultDownloadImageApi
  const { httpProxy } = deps

  const config = await fetchConfig().catch(() => EMPTY_DISCOVER_CONFIG)
  const candidates = buildAssetUrlCandidates(url, config)

  let last: DownloadImageResponseBody | undefined
  for (const candidate of candidates) {
    const response = await download(candidate, pathInPosix, httpProxy)
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

- [x] **Step 4: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/api/downloadImageWithFailover.test.ts`
Expected: PASS（全部用例，含新增）

- [x] **Step 5: 提交**

```bash
git add apps/ui/src/api/downloadImageWithFailover.ts apps/ui/src/api/downloadImageWithFailover.test.ts
git commit -m "feat(downloadImageWithFailover): pass httpProxy through to downloads"
```

---

## Task 3: `resolveMediaDatabaseHttpProxy` + `resolveScrapeHttpProxy` 纯函数

**Files:**
- Modify: `apps/ui/src/lib/mediaDatabaseAccess.ts`
- Test: `apps/ui/src/lib/mediaDatabaseAccess.test.ts`（新增）

- [x] **Step 1: 写失败测试**

创建 `apps/ui/src/lib/mediaDatabaseAccess.test.ts`：

```ts
import { describe, expect, it } from "vitest"
import type { MediaMetadata, UserConfig } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { resolveMediaDatabaseHttpProxy, resolveScrapeHttpProxy } from "./mediaDatabaseAccess"

function buildUserConfig(
  overrides: { tmdb?: UserConfig["tmdb"]; tvdb?: UserConfig["tvdb"] } = {},
): UserConfig {
  return {
    ...defaultUserConfig,
    tmdb: { ...defaultUserConfig.tmdb, ...overrides.tmdb },
    tvdb: { ...defaultUserConfig.tvdb, ...overrides.tvdb },
  }
}

describe("resolveMediaDatabaseHttpProxy", () => {
  it("returns tmdb httpProxy when custom tmdb host + proxy configured", () => {
    const uc = buildUserConfig({ tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" } })
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBe("http://proxy:8080")
  })

  it("returns tvdb httpProxy when custom tvdb host + proxy configured", () => {
    const uc = buildUserConfig({ tvdb: { host: "https://api4.thetvdb.com", httpProxy: "http://proxy:9090" } })
    expect(resolveMediaDatabaseHttpProxy("TVDB", uc)).toBe("http://proxy:9090")
  })

  it("returns undefined when host is empty", () => {
    const uc = buildUserConfig({ tmdb: { host: "", httpProxy: "http://proxy:8080" } })
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined()
  })

  it("returns undefined when host is not a parseable URL", () => {
    const uc = buildUserConfig({ tmdb: { host: "not a url", httpProxy: "http://proxy:8080" } })
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined()
  })

  it("returns undefined when httpProxy is blank", () => {
    const uc = buildUserConfig({ tmdb: { host: "https://api.themoviedb.org", httpProxy: "   " } })
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBeUndefined()
  })

  it("trims surrounding whitespace from httpProxy", () => {
    const uc = buildUserConfig({ tmdb: { host: "https://api.themoviedb.org", httpProxy: "  http://proxy:8080  " } })
    expect(resolveMediaDatabaseHttpProxy("TMDB", uc)).toBe("http://proxy:8080")
  })
})

describe("resolveScrapeHttpProxy", () => {
  it("resolves the proxy from the tvshow database", () => {
    const uc = buildUserConfig({ tvdb: { host: "https://api4.thetvdb.com", httpProxy: "http://proxy:9090" } })
    const md = { type: "tvshow-folder", tvShow: { id: "1", database: "TVDB", name: "T", seasons: [] } } as MediaMetadata
    expect(resolveScrapeHttpProxy(md, uc)).toBe("http://proxy:9090")
  })

  it("returns undefined when the database is missing", () => {
    const uc = buildUserConfig({ tmdb: { host: "https://api.themoviedb.org", httpProxy: "http://proxy:8080" } })
    const md = { type: "movie-folder", movie: { id: "1", name: "M" } } as MediaMetadata
    expect(resolveScrapeHttpProxy(md, uc)).toBeUndefined()
  })
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `cd apps/ui && pnpm vitest run src/lib/mediaDatabaseAccess.test.ts`
Expected: FAIL — `resolveMediaDatabaseHttpProxy` / `resolveScrapeHttpProxy` 未定义。

- [x] **Step 3: 实现**

在 `apps/ui/src/lib/mediaDatabaseAccess.ts` 顶部增加 import：

```ts
import { isEmpty } from "es-toolkit/compat"
import type { MediaMetadata, UserConfig } from "@core/types"
```

在文件末尾追加：

```ts
/**
 * Resolve the outbound HTTP proxy for a media database. Mirrors the rule in
 * `fetchTmdb` / `fetchTvdb`: the proxy only applies when the user configured
 * a custom host (non-empty, parseable) AND set an httpProxy. Otherwise the
 * default upstream (mediadb.vercel.app) is used directly.
 */
export function resolveMediaDatabaseHttpProxy(
  database: "TMDB" | "TVDB",
  userConfig: UserConfig,
): string | undefined {
  const cfg = database === "TMDB" ? userConfig.tmdb : userConfig.tvdb
  if (!cfg) return undefined
  if (isEmpty(cfg.host)) return undefined
  if (!URL.canParse(cfg.host!)) return undefined
  const proxy = cfg.httpProxy?.trim()
  return proxy || undefined
}

/**
 * Resolve the proxy for a scrape task from the media metadata's database.
 */
export function resolveScrapeHttpProxy(
  mediaMetadata: MediaMetadata,
  userConfig: UserConfig,
): string | undefined {
  const database =
    mediaMetadata.type === "tvshow-folder"
      ? mediaMetadata.tvShow?.database
      : mediaMetadata.movie?.database
  if (!database) return undefined
  return resolveMediaDatabaseHttpProxy(database, userConfig)
}
```

- [x] **Step 4: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/lib/mediaDatabaseAccess.test.ts`
Expected: PASS（8 个用例）

- [x] **Step 5: 提交**

```bash
git add apps/ui/src/lib/mediaDatabaseAccess.ts apps/ui/src/lib/mediaDatabaseAccess.test.ts
git commit -m "feat(mediaDatabaseAccess): add http proxy resolvers for scrape downloads"
```

---

## Task 4: `downloadScrapeImage` 助手 + 接入 poster/fanart mutation

**Files:**
- Create: `apps/ui/src/lib/downloadScrapeImage.ts`
- Test: `apps/ui/src/lib/downloadScrapeImage.test.ts`（新增）
- Modify: `apps/ui/src/hooks/useScrapePosterMutation.ts`
- Modify: `apps/ui/src/hooks/useScrapeFanartMutation.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/ui/src/lib/downloadScrapeImage.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest"
import type { MediaMetadata } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { downloadScrapeImage } from "./downloadScrapeImage"

const movie: MediaMetadata = {
  type: "movie-folder",
  mediaFolderPath: "/media/Fight Club",
  movie: { id: "550", database: "TMDB", name: "Fight Club" },
} as MediaMetadata

describe("downloadScrapeImage", () => {
  it("downloads through the configured tmdb proxy", async () => {
    const download = vi.fn().mockResolvedValue({ data: { url: "u", path: "/p" } })
    const uc = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
    await downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
      downloadImageWithFailover: download,
    })
    expect(download).toHaveBeenCalledWith("https://image.tmdb.org/x.jpg", "/media/poster.jpg", {
      httpProxy: "http://proxy:8080",
    })
  })

  it("downloads directly when no proxy is configured", async () => {
    const download = vi.fn().mockResolvedValue({ data: { url: "u", path: "/p" } })
    const uc = { ...defaultUserConfig, tmdb: { host: "", apiKey: "", httpProxy: "" } }
    await downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
      downloadImageWithFailover: download,
    })
    expect(download).toHaveBeenCalledWith("https://image.tmdb.org/x.jpg", "/media/poster.jpg", {
      httpProxy: undefined,
    })
  })

  it("throws when the download fails", async () => {
    const download = vi.fn().mockResolvedValue({
      data: { url: "u", path: "/p" },
      error: "HTTP error! status: 503",
    })
    const uc = { ...defaultUserConfig }
    await expect(
      downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
        downloadImageWithFailover: download,
      }),
    ).rejects.toThrow("HTTP error! status: 503")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/ui && pnpm vitest run src/lib/downloadScrapeImage.test.ts`
Expected: FAIL — 模块不存在（import error）。

- [ ] **Step 3: 实现 `downloadScrapeImage`**

创建 `apps/ui/src/lib/downloadScrapeImage.ts`：

```ts
import type { MediaMetadata, UserConfig } from "@core/types"
import { downloadImageWithFailover } from "@/api/downloadImageWithFailover"
import { resolveScrapeHttpProxy } from "@/lib/mediaDatabaseAccess"

export interface DownloadScrapeImageDeps {
  downloadImageWithFailover?: typeof downloadImageWithFailover
}

/**
 * Download one scrape image, routing through the user-configured TMDB/TVDB
 * HTTP proxy when a custom host + proxy pair is configured. Throws on failure.
 */
export async function downloadScrapeImage(
  mediaMetadata: MediaMetadata,
  imageUrl: string,
  filePath: string,
  userConfig: UserConfig,
  deps: DownloadScrapeImageDeps = {},
): Promise<void> {
  const download = deps.downloadImageWithFailover ?? downloadImageWithFailover
  const httpProxy = resolveScrapeHttpProxy(mediaMetadata, userConfig)
  const response = await download(imageUrl, filePath, { httpProxy })
  if (response.error) {
    throw new Error(response.error)
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/lib/downloadScrapeImage.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 接入 `useScrapePosterMutation`**

修改 `apps/ui/src/hooks/useScrapePosterMutation.ts`：

把 `import { downloadImageWithFailover } from "@/api/downloadImageWithFailover"` 替换为：

```ts
import { useConfig } from "./userConfig"
import { downloadScrapeImage } from "@/lib/downloadScrapeImage"
```

在 hook 内（`useMutation` 之前）加入 `useConfig`：

```ts
  const { getTvShowById, getMovieById } = useTmdbQueries()
  const { getSeriesExtended, getMovieExtended } = useTvdbQueries()
  const { userConfig } = useConfig()
```

把 mutationFn 的下载段：

```ts
      const response = await downloadImageWithFailover(posterUrl, posterPath)
      if (response.error) {
        throw new Error(response.error)
      }
```

替换为：

```ts
      await downloadScrapeImage(mediaMetadata, posterUrl, posterPath, userConfig)
```

- [ ] **Step 6: 接入 `useScrapeFanartMutation`**

对 `apps/ui/src/hooks/useScrapeFanartMutation.ts` 做完全相同的三处修改（import、`useConfig()`、下载段替换为 `await downloadScrapeImage(mediaMetadata, fanartUrl, fanartPath, userConfig)`）。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/hooks/useScrapePosterMutation.test.ts src/hooks/useScrapeFanartMutation.test.ts src/lib/downloadScrapeImage.test.ts`
Expected: PASS — 这两个 mutation 测试只测 `resolvePosterUrl`/`resolveFanartUrl` 纯函数，不受 hook 改动影响。

- [ ] **Step 8: 提交**

```bash
git add apps/ui/src/lib/downloadScrapeImage.ts apps/ui/src/lib/downloadScrapeImage.test.ts apps/ui/src/hooks/useScrapePosterMutation.ts apps/ui/src/hooks/useScrapeFanartMutation.ts
git commit -m "feat(scrape): route poster/fanart downloads through configured proxy"
```

---

## Task 5: 缩略图任务代理透传

**Files:**
- Modify: `apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts`
- Modify: `apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts`
- Modify: `apps/ui/src/hooks/useScrapeThumbnailMutation.ts`
- Test: `apps/ui/src/hooks/useScrapeThumbnailMutation.test.tsx`（新增）

- [ ] **Step 1: 写失败测试**

创建 `apps/ui/src/hooks/useScrapeThumbnailMutation.test.tsx`：

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import type { MediaMetadata, UserConfig } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"

const mockTmdbMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockTvdbMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock("./useDownloadThumbnailFromTMDB", () => ({
  useDownloadThumbnailFromTMDB: () => ({ mutateAsync: mockTmdbMutateAsync }),
}))
vi.mock("./useDownloadThumbnailFromTVDB", () => ({
  useDownloadThumbnailFromTVDB: () => ({ mutateAsync: mockTvdbMutateAsync }),
}))

let useConfigValue: UserConfig = defaultUserConfig
vi.mock("./userConfig", () => ({
  useConfig: () => ({ appConfig: {}, userConfig: useConfigValue }),
}))

import { useScrapeThumbnailMutation } from "./useScrapeThumbnailMutation"

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const tvShowMetadata: MediaMetadata = {
  type: "tvshow-folder",
  mediaFolderPath: "/media/TV",
  tvShow: { id: "123", database: "TMDB", name: "TV", seasons: [] },
  mediaFiles: [{ absolutePath: "/media/TV/s01e01.mkv", seasonNumber: 1, episodeNumber: 1 }],
} as MediaMetadata

describe("useScrapeThumbnailMutation", () => {
  beforeEach(() => {
    mockTmdbMutateAsync.mockClear()
    mockTvdbMutateAsync.mockClear()
    useConfigValue = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
  })

  it("passes the resolved proxy to the TMDB thumbnail downloader", async () => {
    const { result } = renderHook(() => useScrapeThumbnailMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: tvShowMetadata })
    expect(mockTmdbMutateAsync).toHaveBeenCalledWith({
      seriesId: 123,
      mediaFiles: tvShowMetadata.mediaFiles,
      httpProxy: "http://proxy:8080",
    })
  })

  it("passes no proxy when none is configured", async () => {
    useConfigValue = { ...defaultUserConfig, tmdb: { host: "", apiKey: "", httpProxy: "" } }
    const { result } = renderHook(() => useScrapeThumbnailMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: tvShowMetadata })
    expect(mockTmdbMutateAsync).toHaveBeenCalledWith({
      seriesId: 123,
      mediaFiles: tvShowMetadata.mediaFiles,
      httpProxy: undefined,
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/ui && pnpm vitest run src/hooks/useScrapeThumbnailMutation.test.tsx`
Expected: FAIL — 断言收到 `httpProxy: undefined`（当前 mutateAsync 调用不含 `httpProxy` 字段，且变量类型无该字段）。

- [ ] **Step 3: 修改 `useDownloadThumbnailFromTMDB.ts`**

`DownloadThumbnailFromTMDBVariables` 增加字段：

```ts
export interface DownloadThumbnailFromTMDBVariables {
  seriesId: number
  mediaFiles: MediaFileMetadata[]
  httpProxy?: string
}
```

mutationFn 解构与下载调用：

```ts
    mutationFn: async (variables: DownloadThumbnailFromTMDBVariables) => {
      const { seriesId, mediaFiles, httpProxy } = variables
```

以及：

```ts
        await downloadImageWithFailover(stillPath.stillPath, stillFilePath, { httpProxy })
```

- [ ] **Step 4: 修改 `useDownloadThumbnailFromTVDB.ts`**

同样修改 `DownloadThumbnailFromTVDBVariables`（加 `httpProxy?: string`）、mutationFn 解构，以及：

```ts
        await downloadImageWithFailover(stillPath.stillPath, stillFilePath, { httpProxy })
```

- [ ] **Step 5: 修改 `useScrapeThumbnailMutation.ts`**

在顶部 import 增加：

```ts
import { resolveScrapeHttpProxy } from "@/lib/mediaDatabaseAccess"
```

把 tvshow 两个分支的 `mutateAsync` 调用改为携带 `httpProxy`：

```ts
        if (tvShow.database === "TMDB") {
          const tvShowId = parseInt(tvShow.id, 10)
          await downloadThumbnailFromTMDBMutation.mutateAsync({
            seriesId: tvShowId,
            mediaFiles: mediaMetadata.mediaFiles ?? [],
            httpProxy: resolveScrapeHttpProxy(mediaMetadata, userConfig),
          })
          return
        }
        if (tvShow.database === "TVDB") {
          const tvShowId = parseInt(tvShow.id, 10)
          await downloadThumbnailFromTVDBMutation.mutateAsync({
            seriesId: tvShowId,
            mediaFiles: mediaMetadata.mediaFiles ?? [],
            httpProxy: resolveScrapeHttpProxy(mediaMetadata, userConfig),
          })
          return
        }
```

（movie 分支仍是 TODO 桩，不改动。）

- [ ] **Step 6: 运行测试确认通过**

Run: `cd apps/ui && pnpm vitest run src/hooks/useScrapeThumbnailMutation.test.tsx`
Expected: PASS（2 个用例）

- [ ] **Step 7: 提交**

```bash
git add apps/ui/src/hooks/useDownloadThumbnailFromTMDB.ts apps/ui/src/hooks/useDownloadThumbnailFromTVDB.ts apps/ui/src/hooks/useScrapeThumbnailMutation.ts apps/ui/src/hooks/useScrapeThumbnailMutation.test.tsx
git commit -m "feat(scrape): route episode thumbnails through configured proxy"
```

---

## Task 6: CLI `/api/downloadImage` 代理转发

**Files:**
- Modify: `apps/cli/src/route/DownloadImageAsFile.ts`
- Test: `apps/cli/src/route/DownloadImageAsFile.test.ts`（新增）

- [ ] **Step 1: 写失败测试**

创建 `apps/cli/src/route/DownloadImageAsFile.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDoDownloadImageAsFile = vi.fn()
const mockCreateProxiedFetch = vi.fn()

vi.mock("@smm/core-routes", () => ({
  doDownloadImageAsFile: mockDoDownloadImageAsFile,
  createProxiedFetch: mockCreateProxiedFetch,
}))

vi.mock("@/utils/buildAllowlist", () => ({
  buildAllowlist: vi.fn().mockResolvedValue(["/media"]),
}))

import { processDownloadImageAsFile } from "./DownloadImageAsFile"

describe("processDownloadImageAsFile", () => {
  beforeEach(() => {
    mockDoDownloadImageAsFile.mockReset()
    mockCreateProxiedFetch.mockReset()
    mockDoDownloadImageAsFile.mockResolvedValue({ data: { url: "u", path: "p" } })
  })

  it("fetches through the configured proxy when body.httpProxy is set", async () => {
    const proxiedFetch = vi.fn()
    mockCreateProxiedFetch.mockReturnValue(proxiedFetch)

    const result = await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
      httpProxy: "http://proxy:8080",
    })

    expect(mockCreateProxiedFetch).toHaveBeenCalledTimes(1)
    expect(mockCreateProxiedFetch).toHaveBeenCalledWith("http://proxy:8080", expect.any(Object))
    expect(mockDoDownloadImageAsFile).toHaveBeenCalledWith(
      expect.objectContaining({ httpProxy: "http://proxy:8080" }),
      expect.objectContaining({ fetchImpl: proxiedFetch }),
    )
    expect(result).toEqual({ data: { url: "u", path: "p" } })
  })

  it("uses the global fetch when body.httpProxy is absent", async () => {
    await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
    })

    expect(mockCreateProxiedFetch).not.toHaveBeenCalled()
    expect(mockDoDownloadImageAsFile).toHaveBeenCalledWith(
      expect.objectContaining({ fetchImpl: undefined }),
    )
  })

  it("ignores a blank httpProxy", async () => {
    await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
      httpProxy: "   ",
    })

    expect(mockCreateProxiedFetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/cli && pnpm vitest run src/route/DownloadImageAsFile.test.ts`
Expected: FAIL — 当前实现不创建 proxied fetch。

- [ ] **Step 3: 实现**

修改 `apps/cli/src/route/DownloadImageAsFile.ts`：

import 行改为：

```ts
import {
  createProxiedFetch,
  doDownloadImageAsFile as doDownloadImageAsFileCore,
} from "@smm/core-routes";
```

`processDownloadImageAsFile` 改为：

```ts
export async function processDownloadImageAsFile(
  body: DownloadImageRequestBody,
): Promise<DownloadImageResponseBody> {
  const allowlist = await buildAllowlist();
  const httpProxy = body.httpProxy?.trim();
  const fetchImpl = httpProxy
    ? createProxiedFetch(httpProxy, coreRoutesLogger)
    : undefined;
  return doDownloadImageAsFileCore(body, { allowlist, logger: coreRoutesLogger, fetchImpl });
}
```

（`createProxiedFetch` 内部用 `formatProxyHostForLog` 脱敏日志，不记录原始 proxy。）

- [ ] **Step 3a: 修复 shared node handler 的 rawBody 日志（安全）**

`@smm/core-routes` 的 node http 路由 `packages/core-routes/src/routes/downloadImageAsFileRoute.ts` 在 `[DownloadImageAsFile] POST /api/downloadImage` 日志中记录了完整 `rawBody`（Task 5 之后 `httpProxy` 会出现在 body 里，可能含 `user:pass@` 凭据）。改为只记录 `{ url, path }`：

```ts
    const rawBody = (await readJsonBody(req)) as DownloadImageRequestBody;
    const { url, path } = rawBody;
    ctx.config.logger?.info(
      { url, path },
      "[DownloadImageAsFile] POST /api/downloadImage",
    );
```

`packages/core-routes/src/core-routes.test.ts` 的 `POST /api/downloadImage` 用例不断言日志内容，无需改动；若运行中发现 logger 断言失败则同步更新。把 `packages/core-routes/src/routes/downloadImageAsFileRoute.ts` 加入本任务的提交。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/cli && pnpm vitest run src/route/DownloadImageAsFile.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add apps/cli/src/route/DownloadImageAsFile.ts apps/cli/src/route/DownloadImageAsFile.test.ts packages/core-routes/src/routes/downloadImageAsFileRoute.ts
git commit -m "feat(cli): download images through configured proxy via /api/downloadImage"
```

---

## Task 7: 全量验证

**Files:** 无（验证）

- [ ] **Step 1: 类型检查**

Run: `cd apps/ui && pnpm typecheck`
Expected: 通过，无类型错误。

Run: `cd apps/cli && pnpm typecheck`
Expected: 通过，无类型错误。

Run: `cd packages/core && pnpm typecheck`
Expected: 通过，无类型错误。

- [ ] **Step 2: 运行受影响包的完整测试**

Run: `cd packages/core && pnpm test`
Expected: 全部 PASS（类型改动不影响现有 core 测试）。

Run: `cd apps/ui && pnpm test`
Expected: 全部 PASS（含新增/扩展的 `downloadImage`、`downloadImageWithFailover`、`mediaDatabaseAccess`、`downloadScrapeImage`、`useScrapeThumbnailMutation` 测试）。

Run: `cd apps/cli && pnpm test`
Expected: 全部 PASS（含新增的 `DownloadImageAsFile` 测试）。

- [ ] **Step 3: 提交收尾（如有未提交的修正）**

```bash
git add -A
git commit -m "chore(scrape): finalize proxy download implementation"
```

（若无改动，跳过本步。）

---

## Self-Review

**Spec 覆盖检查：**
- [x] `DownloadImageRequestBody` 加 `httpProxy` — Task 1
- [x] `downloadImageApi` 透传 — Task 1
- [x] `downloadImageWithFailover` 透传 — Task 2
- [x] `resolveMediaDatabaseHttpProxy` 纯函数（镜像 API 规则）— Task 3
- [x] poster/fanart 接入 — Task 4
- [x] 缩略图接入 — Task 5
- [x] CLI 路由代理转发 — Task 6
- [x] 测试覆盖（纯函数/透传/CLI 代理分支/mutation 接入）— Task 1-6
- [x] 范围外不改造（useImage、nfo、季海报、core-routes）— 无对应任务

**占位符扫描：** 无 TBD/TODO/「类似 Task N」；每个代码步骤含完整代码。

**类型一致性：**
- `resolveMediaDatabaseHttpProxy(database: "TMDB" | "TVDB", userConfig)` — Task 3 定义，Task 3/4 使用一致。
- `resolveScrapeHttpProxy(mediaMetadata, userConfig)` — Task 3 定义，Task 4/5 使用一致。
- `downloadImageWithFailover(url, path, { httpProxy })` — deps 第三参在 Task 2/4/5 使用一致。
- `downloadImageApi(url, path, httpProxy?)` — Task 1 定义，Task 2 使用一致。
- `httpProxy?: string` 变量命名在 5 个 mutation / 变体 hook 中一致。
