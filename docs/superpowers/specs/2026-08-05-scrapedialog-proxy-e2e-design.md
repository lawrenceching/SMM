---
name: scrapedialog-proxy-e2e
description: "为 ScrapeDialog 图片下载走 HTTP 代理添加 common e2e 测试 (TMDB & TVDB, 覆盖 local/Electron/Docker/HarmonyOS)"
type: spec
status: approved
---

# ScrapeDialog 图片下载走 HTTP 代理 — 端到端测试

## 1. Background

`scrapedialog-proxy-download`（2026-08-04）已实现并完成单元验证：当用户为 TMDB/TVDB 配置了「自定义 host + HTTP 代理」时，ScrapeDialog 的 poster / fanart / 剧集缩略图下载通过 `POST /api/downloadImage` 携带 `httpProxy`，后端 `createProxiedFetch` 走代理。该功能仅靠单测覆盖，缺少端到端验证。

本 spec 为该功能添加 **common e2e 测试**：经过 HTTP proxy 从 TMDB & TVDB 刮削内容，覆盖 **local / Electron / Docker / HarmonyOS** 四个平台（与现有 `apps/e2e/common/httpproxy` 套件一致）。

**验证策略（用户 2026-08-05 已锁定）**：先配置一个**错误的 HTTP proxy 地址**，断言刮削**失败**；再把 proxy 修正为可用地址，再次刮削并断言**成功**。这是一个确定性验证：在开放网络下，若代理链路未接通（图片被绕过直连），错误 proxy 会被忽略、刮削本应成功——因此「错误 proxy → 失败」在任意网络环境都能证明代理确实被使用。

## 2. 白箱分析：为什么只覆盖 TV show

图片走代理的唯一链路是共享助手：

```
downloadScrapeImage(mediaMetadata, url, path, userConfig)
  → resolveScrapeHttpProxy(mediaMetadata, userConfig)   // tvshow→tvShow.database, movie→movie.database
  → downloadImageWithFailover(url, path, { httpProxy })
  → POST /api/downloadImage { url, path, httpProxy }
  → CLI createProxiedFetch(httpProxy) → 上游 CDN
```

- `useScrapePosterMutation` / `useScrapeFanartMutation` 对 **tvshow-folder 和 movie-folder 共用同一条** `downloadScrapeImage` 链路；唯一差异是 `resolveScrapeHttpProxy` 读取 `tvShow.database` 还是 `movie.database`——该纯函数已单测覆盖三个分支（tvshow/movie/music）。
- 剧集缩略图（thumbnails）仅 TV show 有。
- nfo 任务对 TV / Movie 都经代理访问 API（不下载图片）。

因此 movie 刮削只是换一组 seed fixture 复用完全相同的下载链路，不增加新的代理覆盖点。**仅 TV show 足够**：TMDB TV + TVDB TV 两个 spec 已覆盖 poster（共享）、fanart（共享）、thumbnails（TV 独有）、nfo（API 走代理）的完整代理矩阵。

## 3. 两个新 spec

位置：`apps/e2e/common/httpproxy/`（与现有 httpproxy 套件同目录）。

| 文件 | 数据库 | seed 步骤 | host | API key |
|------|--------|-----------|------|---------|
| `ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts` | TMDB | `TV show folder with TMDB id 84666 and one episode was imported` | `https://api.themoviedb.org/3` | `TMDB_API_KEY` |
| `ScrapeTvShowByTvdbBehindHttpProxy.e2e.ts` | TVDB | `TV show folder with TVDB id 355969 and one episode was imported` | `https://api4.thetvdb.com/v4` | `TVDB_API_KEY` |

`@supports local, Electron, HarmonyOS, Docker`（含 Electron，用户已确认）。

## 4. 两阶段验证流程（单个 `it` 场景）

```
before()
  ├─ isReverseProxyAccessible() 守卫
  └─ useEmbeddedHttpProxy() (local/Electron)
       → startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS)
      否则 (Docker/ohos)
       → 检查 TMDB_HTTP_PROXY / TVDB_HTTP_PROXY env 可达 (isHttpProxyAccessible)

beforeEach()
  └─ setup(resetUserConfig) → config.<db> = { host: <官方 host>, apiKey: env, httpProxy: WRONG_HTTP_PROXY }

it('Scenario: TV show scraped via <DB> behind HTTP proxy (dead → live)')
  ├─ Phase A（错误 proxy）
  │   ├─ given  seed 文件夹（现有步骤）
  │   ├─ when  folder from context was selected
  │   ├─ when  I click "Scrape" button in TV show panel
  │   ├─ then  scrape dialog shows all tasks pending
  │   ├─ when  I start scrape
  │   ├─ then  scrape dialog shows all TV show tasks failed   ← 新步骤
  │   └─ when  I close scrape dialog
  ├─ Phase B（修正 proxy）
  │   ├─ updateUserConfigViaBrowser(<db>.httpProxy = liveProxy)
  │   ├─ page.refresh(); Sidebar.waitForFolderName(folder.folderName)
  │   ├─ when  folder from context was selected
  │   ├─ when  I click "Scrape" button in TV show panel
  │   ├─ then  scrape dialog shows all tasks pending          ← 重开对话框重置任务状态
  │   ├─ when  I start scrape
  │   └─ then  scrape dialog shows all TV show tasks completed
  └─ then  断言磁盘产物（poster/fanart/S01E01.jpg/tvshow.nfo/S01E01.nfo，镜像 Scrape.e2e.ts）
```

**关键点：**

- **live proxy 取值**：`getConfiguredHttpProxyAddress('tmdb'|'tvdb')`——内部已优先返回运行中的内嵌代理地址（local/Electron），否则回退 `TMDB_HTTP_PROXY`/`TVDB_HTTP_PROXY` env（Docker/ohos）。
- **`WRONG_HTTP_PROXY`**：常量 `http://127.0.0.1:1`（端口 1 在 local/Electron/Docker 容器/鸿蒙设备上均关闭，ECONNREFUSED 快速失败）。
- **Phase A 失败点**：4 个任务全部在「元数据解析」的 API 调用阶段失败（`fetchTmdb`/`fetchTvdb` → 反向代理 `X-Http-Proxy` → `createProxiedFetch`(错误 proxy) → 502 → 任务 failed）。这是内建的耦合（API 与图片共用同一份 proxy 配置）；图片下载环节在 Phase B 正向路径被真正执行。
- **无直连回退**：`createProxiedFetch` 已在 CLI（`apps/cli/server.ts` `buildReverseProxyConfig`）与鸿蒙（`apps/ohos/src/http/server.ts`）的反向代理配置中接线；`X-Http-Proxy` 存在时不会 `direct-fallback`。错误 proxy → 快速 502。
- **Docker env 重写不影响死代理常量**：`ci/run-e2e-test-lib.ts` 只把 `TMDB_HTTP_PROXY`/`TVDB_HTTP_PROXY` 里的 `127.0.0.1` 重写为 `host.docker.internal`；spec 内硬编码的 `WRONG_HTTP_PROXY` 不受影响（容器内 `127.0.0.1:1` 即容器自身）。

## 5. 代码改动

### 5.1 `apps/ui/src/components/dialogs/UIScrapeDialogTable.tsx`（一行）

状态单元格 `<div data-testid="scrape-dialog-task-status-${task.id}">` 增加 `data-status={task.status}`。

**原因**：失败任务的状态文本是**本地化的错误**（`localizeScrapeError(task.failedReason)`，如 "TMDB 不可用" / "Network error"），不是字面量 "Failed"。e2e 需要确定性地断言失败状态，故用 `data-status` 属性，而非文本。

### 5.2 `apps/e2e/test/steps/scrape-dialog-steps.ts`（新步骤）

```ts
registerStep('scrape dialog shows all TV show tasks failed', async () => {
  await browser.waitUntil(async () => {
    const ids = ['poster', 'fanart', 'thumbnails', 'nfo']
    const results = await Promise.all(ids.map(async (id) =>
      (await $(`[data-testid="scrape-dialog-task-status-${id}"]`)
        .getAttribute('data-status')) === 'failed'))
    return results.every(Boolean)
  }, { timeout: 60 * 1000, interval: 1000, timeoutMsg: 'ScrapeDialog tasks did not all fail' })
})
```

已有的「scrape dialog shows all TV show tasks completed」步骤保持文本匹配，无需改动。

### 5.3 两个新 spec（自包含，风格对齐现有 httpproxy 套件）

- `before`/`after`：代理可达守卫 + 内嵌代理启停。
- `beforeEach`/`afterEach`：`setup`/`cleanup` + `resetUserConfig`（初始为 `WRONG_HTTP_PROXY`）+ 清空测试目录。
- `it`：两阶段流程（见 §4）。
- Phase B 修正 proxy：`updateUserConfigViaBrowser`（`apps/e2e/test/lib/browser-fs.ts` 已有）写 `smm.json`，随后 `page.refresh()` 让 `useConfig()` 重新读取。

**API key 要求**：`TMDB_API_KEY` / `TVDB_API_KEY` 须在 e2e env 中提供（与现有 `Scrape.e2e.ts`、httpproxy 套件相同）。Phase A 不需要 key（死在代理阶段），Phase B 需要。

## 6. 平台注意事项

| 平台 | 死代理 | live proxy | 备注 |
|------|--------|-----------|------|
| local / Electron | `127.0.0.1:1` 主机侧 ECONNREFUSED | 内嵌 proxy-chain（`prepareRequestFunction` 已支持观测，本设计不依赖） | 默认 `USE_EMBEDDED_HTTP_PROXY=true` |
| Docker | 容器内 `127.0.0.1:1` ECONNREFUSED | `TMDB/TVDB_HTTP_PROXY` env（runner 重写为 `host.docker.internal`） | `http-proxy` Compose 服务已存在 |
| HarmonyOS | 设备上 `127.0.0.1:1` ECONNREFUSED | `TMDB/TVDB_HTTP_PROXY` env（远程代理） | app 无法访问主机 127.0.0.1，用 env |

**不依赖代理流量观测**：验证靠「死代理 → 失败」+「活代理 → 成功」的确定性结果，与内嵌代理/Compose 代理是否记录流量无关，因此三平台断言一致。

## 7. 验证计划

1. local：`bun ci/run-e2e-test.ts --spec "./common/httpproxy/ScrapeTvShowByTmdbBehindHttpProxy.e2e.ts"`（需 `TMDB_API_KEY`，默认内嵌代理）。
2. local：TVDB 同款命令（需 `TVDB_API_KEY`）。
3. `bun ci/run-e2e-test.ts --platform electron|docker|ohos --spec ...` 按可用平台执行。
4. 每个平台绿灯后，按约定更新 `apps/e2e/common-e2e-tests-verification.md` 矩阵与 `@supports` 标注。

## 8. 非目标

- movie 刮削的 e2e（白箱结论：共享链路，TV 已覆盖）。
- 代理流量观测断言（`prepareRequestFunction` 记录 / http-proxy 容器统计端点）——两阶段验证已确定性覆盖。
- 修改 `Scrape.e2e.ts` 或既有 httpproxy 套件。
- 修改 `@smm/core-routes` / CLI 后端代理逻辑（已在上个功能完成）。
