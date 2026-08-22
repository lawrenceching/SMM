# TMDB 集成（v3）

SMM 通过 `apps/core` 统一访问 TMDB：**全部出站流量**经 `Core` + `NetworkPort`，不直连上游（浏览器侧见 [network-core.md](./network-core.md)）。

| 入口 | 状态 | 说明 |
|------|------|------|
| CLI | ✅ | `smm tmdb search` → 进程内 `Core` |
| AI Tool | ✅ | Chat 工具 → `core-routes` → `Core` |
| MCP Tool | ✅ | MCP 工具 → `core-routes` → `Core` |
| Web UI | ⏳ | 目标：`BrowserNetworkPort` → `POST /api/core/fetch` → `Core`（迁移中） |

```mermaid
flowchart TB
  CLI["apps/cli"]
  WEB["apps/ui ⏳"]
  AI["AI Tool ✅"]
  MCP["MCP Tool ✅"]

  CR["packages/core-routes<br/>/api/core/fetch · chat · MCP"]
  CORE["apps/core<br/>searchInTmdb · getMovieInTmdb · getTvShowInTmdb"]
  NET["NetworkPort<br/>NodejsNetworkPort / BrowserNetworkPort"]
  TMDB["TMDB 上游"]

  CLI -->|进程内| CORE
  WEB --> CR
  AI --> CR
  MCP --> CR
  CR --> CORE
  CORE --> NET --> TMDB
```

**配置**：host / apiKey / httpProxy 来自 `userConfig.tmdb`；各入口可临时覆盖（CLI flags、工具参数 `baseURL` 等）。

---

## apps/core API

三个公开方法，共用 `createTmdbClient` 与 `NetworkPort` 出站。

| 方法 | 用途 |
|------|------|
| `searchInTmdb(keyword, options)` | 按关键词搜索 TV / movie |
| `getMovieInTmdb(id, options)` | 按 TMDB id 拉电影详情 |
| `getTvShowInTmdb(id, options)` | 按 TMDB id 拉剧集详情 |

```ts
core.searchInTmdb(keyword, {
  type: "tv" | "movie",
  language?: string,   // 离线校验 packages/core/tmdbPrimaryTranslations.ts
  host?: string,       // 默认 userConfig.tmdb.host
  password?: string,   // 默认 userConfig.tmdb.apiKey
  proxy?: string,      // 默认 userConfig.tmdb.httpProxy
})

core.getMovieInTmdb(id, { language?, host?, password?, proxy? })
core.getTvShowInTmdb(id, { language?, host?, password?, proxy? })
```

- `TmdbClient` 经 `NetworkPort` 发请求；`reverseProxyUrl: null`，`proxy` 作为 `FetchInit.proxy`（非浏览器 reverse proxy）。
- 显式 `language` 须在静态 primary translations 列表中；省略时按 `preferMediaLanguage` → OS → `en-US`。

实现：`apps/core/src/Core.ts`。

---

## CLI

### 命令

目前仅暴露搜索子命令：

```bash
smm tmdb search "<keyword>" --type tv|movie [options]
```

### 输出格式

```bash
$ smm tmdb search "keyword" --type tv
#1 {tmdbid} {title} ({release date})
{overview}
#2 {tmdbid2} {title2} ({release date})
{overview}
```

### 常用场景

```bash
# 默认 host（userConfig / 内置）
smm tmdb search "keyword" --type tv

# 指定语言
smm tmdb search "keyword" --type tv --lang zh-CN

# 经 HTTP/SOCKS 代理
smm tmdb search "keyword" --type tv --proxy "socks5://proxy.example.com:7079"

# 自定义 host + API key
smm tmdb search "keyword" --type tv \
  --host "https://api.themoviedb.org/3" \
  --password "your-api-key" \
  --proxy "socks5://proxy.example.com:7079"
```

### 参数

| 参数 | 说明 |
|------|------|
| `--type` | `tv` \| `movie`（必填） |
| `--lang` | TMDB primary translation（如 `zh-CN`）；无效值离线报错 |
| `--host` | 覆盖 `userConfig.tmdb.host` |
| `--password` | 覆盖 `userConfig.tmdb.apiKey` |
| `--proxy` | 覆盖 `userConfig.tmdb.httpProxy` |

实现：`apps/cli/src/cli/runCli.ts`（格式化：`tmdbSearchFormat.ts`）。

---

## AI Tool

Chat 后端工具，**仅服务端**（`packages/core/ai-tool/registry.ts` 中 `frontend: false`）。

| 工具名 | Core 方法 | 说明 |
|--------|-----------|------|
| `tmdb-search` | `searchInTmdb` | 关键词搜索 |
| `tmdb-get-movie` | `getMovieInTmdb` | 电影详情 |
| `tmdb-get-tv-show` | `getTvShowInTmdb` | 剧集详情 |

### 参数（与 CLI 对照）

| 工具字段 | 对应 Core |
|----------|-----------|
| `keyword`, `type` | `searchInTmdb` |
| `id` | `getMovieInTmdb` / `getTvShowInTmdb` |
| `language` | `language`（同 CLI `--lang`） |
| `baseURL` | `host`（同 CLI `--host`） |

host / apiKey / proxy 未在工具参数中指定时，仍走 `userConfig.tmdb`。

类型定义：`packages/core/types/ai-tools/tmdb*.ts`  
执行与构建：`packages/core-routes/src/tools/tmdb.ts`  
注册：`packages/core-routes/src/tools/index.ts`、`chat.ts`；CLI 注入 runner：`apps/cli/src/route/chatRoute.ts`。

System prompt 指引见 `packages/core/ai-tool/systemPrompt.ts`（先 `tmdb-search`，再按 id 拉详情）。

---

## MCP Tool

与 AI Tool **同名、同 schema、同 Core 路径**，经 MCP HTTP 暴露。

| MCP 工具名 | Core 方法 |
|------------|-----------|
| `tmdb-search` | `searchInTmdb` |
| `tmdb-get-movie` | `getMovieInTmdb` |
| `tmdb-get-tv-show` | `getTvShowInTmdb` |

注册：`packages/core-routes/src/mcp/toolHandlers/tmdbTools.ts`  
CLI runner：`apps/cli/src/mcp/mcp.ts`（`searchInTmdb` / `getMovieInTmdb` / `getTvShowInTmdb`）。

本地调试 MCP 客户端：`test/mcp-test-client/index.ts`（`SMM_MCP_URL` + `--tool tmdb-search`）。

---

## Web UI（⏳ v3 迁移）

搜索入口：`MediaDatabaseSearchbox`（`TvShowPanelHeader` / `MovieHeaderV2`）。

**目标路径**（与 Core v3 一致）：

```mermaid
flowchart LR
  A[MediaDatabaseSearchbox] --> B[Core.searchInTmdb]
  B --> C[BrowserNetworkPort]
  C --> D[POST /api/core/fetch]
  D --> E[NodejsNetworkPort]
  E --> F[TMDB]
```

| 层 | 文件 |
|----|------|
| UI | `apps/ui/src/components/MediaDatabaseSearchbox.tsx` |
| 浏览器 Port | `apps/ui/src/core/BrowserNetworkPort.ts` |
| RPC | `apps/cli/src/route/CoreFetch.ts` |
| 出站 | `apps/cli/src/core/NodejsNetworkPort.ts` |

Web 不调用 `smm tmdb search`，但与 CLI 共用 `Core` 与 `userConfig.tmdb` 语义。

---

## 测试

| 范围 | 文件 |
|------|------|
| CLI e2e | `apps/cli/test/tmdb.e2e.ts` — 文档「常用场景」四类搜索 |
| core-routes 单测 | `packages/core-routes/src/tools/tmdb.test.ts` |
| MCP e2e | `apps/e2e/common/mcp/McpOther-TmdbTools.e2e.ts` — 三工具 +  live TMDB |
| MCP 客户端 | `apps/e2e/test/lib/McpClient.ts` |

MCP / 需直连 TMDB 的 e2e 在 `apps/e2e/.env.local` 配置 `TMDB_HOST`、`TMDB_API_KEY`、`TMDB_HTTP_PROXY`（网络受限环境）。

运行 MCP spec：

```bash
cd apps/e2e
pnpm run wdio --spec ./common/mcp/McpOther-TmdbTools.e2e.ts
```
