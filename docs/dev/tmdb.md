# TMDB via SMM cli


**输出格式**
```bash
$ smm tmdb search "keyword"
#{index} {tmdbid} {title} ({release data})
{description}
#{index2} {tmdbid2} {title2} ({release data 2})
{description2}
```

**使用场景**
```
# Search through SMM-provided TMDB host
smm tmdb search "keyword" --type tv

# Search with explicit language
smm tmdb search "keyword" --type tv --lang zh-CN

# Search through SMM-provided TMDB host and HTTP proxy
smm tmdb search "keyword" --type tv --proxy "socks5://proxy.example.com:7079"

# Search through custom TMDB host
smm tmdb search "keyword" --type tv --host "https://tmdb.example.com/v3"

# Search through custom TMDB host and password
smm tmdb search "keyword" --type tv --host "https://tmdb.example.com/v3" --password "password-here"

# Search through custom TMDB host, password and HTTP proxy
smm tmdb search "keyword" --type tv --host "https://tmdb.example.com/v3" --password "password-here" --proxy "socks5://proxy.example.com:7079"
```

**Arguments**
```
--type [tv|movie]
--lang <language>   # TMDB primary translation IETF tag (static snapshot of /3/configuration/primary_translations); omit → userConfig then OS; invalid values error offline
```

## Web UI Implementation

Web UI 的 TMDB 搜索入口是 `MediaDatabaseSearchbox`（电视剧 / 电影面板标题栏）。组件同时支持 TMDB 与 TVDB；本节只描述 **TMDB** 路径。

### 入口与触发

| 位置 | `mediaType` | 选中结果后续 |
|------|-------------|--------------|
| `TvShowPanelHeader` | `tv` | `useSelectTvShowForFolderMutation` → 按 id 拉详情并写 metadata |
| `MovieHeaderV2` | `movie` | 对应 movie 选择 mutation（同样再拉详情） |

用户在 `ImmersiveSearchbox` 输入关键词后按 Enter / 点搜索按钮 → `handleSearch`。

搜索语言优先级：`localStorage.lastSelectedTmdbLanguage` → `userConfig.preferMediaLanguage` → 默认。默认数据库来自 `userConfig.primaryDatabase`（可在搜索框内切换）。

### 流程图（TMDB 搜索）

```mermaid
flowchart TD
  A[用户在 MediaDatabaseSearchbox 输入关键词并搜索] --> B{searchDatabase?}
  B -->|TVDB| Z[TVDB 客户端路径 略]
  B -->|TMDB| C[拼 query + language<br/>GET /search/tv 或 /search/movie]
  C --> D[fetchTmdbOrUndefined]
  D --> E[fetchTmdb]

  E --> F{userConfig.tmdb.host<br/>非空且可解析?}
  F -->|是 自定义上游| G[fetchByInternalReverseProxy]
  G --> G1[hello 拿到 CLI reverseProxyUrl]
  G1 --> G2[浏览器 GET reverseProxyUrl + /search/...]
  G2 --> G3[Header:<br/>X-SMM-Proxy-Upstream-BaseURL = host<br/>可选 Authorization Bearer apiKey<br/>可选 X-Http-Proxy]
  G3 --> G4[CLI reverseProxy<br/>packages/core-routes]
  G4 --> G5[转发到自定义 TMDB host<br/>必要时经用户 SOCKS/HTTP 代理]
  G5 --> H

  F -->|否 默认 / Discover| I[fetchDiscoverConfig]
  I --> J[mediaDatabases 中 type=tmdb 的 URL 列表<br/>若空则用 SMM 默认<br/>mediadb.vercel.app/api/tmdb]
  J --> K[fetchWithFailover]
  K --> K1[先: Discover reverseProxies × upstream 成对尝试]
  K1 --> K2[再: 直连各 TMDB host + /search/...]
  K2 --> K3{全部失败?}
  K3 -->|是| L[HttpFailoverExhaustedError<br/>→ fetchTmdbOrUndefined 返回 undefined]
  K3 -->|否| H

  H{Response ok?}
  L --> M[buildTmdbErrorFromResponse<br/>classifyTmdbError → 展示错误]
  H -->|否| M
  H -->|是| N[解析 TmdbSearchResponseBody]
  N --> O{response.error?}
  O -->|是| P[searchFailed]
  O -->|否| Q[按 mediaType 过滤 results<br/>tv: name / movie: title]
  Q --> R{results 为空?}
  R -->|是| S[searchNoResults]
  R -->|否| T[映射为 ImmersiveSearchResultItem<br/>海报 getTMDBImageUrl w200]
  T --> U[用户点击某条结果]
  U --> V[onSearchResultSelected<br/>database=TMDB + result + searchLanguage]
  V --> W[useSelect*ForFolderMutation<br/>再 fetchTmdb 拉 /tv/:id 或 /movie/:id<br/>写入 MediaMetadata]
```

### 关键代码

| 层 | 文件 | 职责 |
|----|------|------|
| UI | `apps/ui/src/components/MediaDatabaseSearchbox.tsx` | 搜索状态、语言、调 `fetchTmdbOrUndefined`、结果映射 |
| UI | `apps/ui/src/components/ImmersiveSearchbox.tsx` | 输入框 / 结果列表 / 库与语言切换 |
| API | `apps/ui/src/api/tmdb.ts` | `fetchTmdb` / `fetchTmdbOrUndefined`；自定义 host vs Discover 分流 |
| API | `apps/ui/src/api/fetchByInternalReverseProxy.ts` | 经本地 CLI reverse proxy 访问自定义上游 |
| HTTP | `apps/ui/src/lib/http.ts` | `fetchWithFailover`：代理对 + 直连链，失败域名写入 `disabledDomains` |
| CLI | `packages/core-routes` reverse proxy | 读 `X-SMM-Proxy-Upstream-BaseURL` / `X-Http-Proxy` 转发上游 |
| 选中后 | `apps/ui/src/hooks/useSelectTvShowForFolderMutation.ts` 等 | 用搜索结果 id 再拉详情并更新文件夹 metadata |

### 两条出站路径对照

1. **自定义 TMDB host**（设置里配置了 `userConfig.tmdb.host`）  
   浏览器 → CLI 内置 reverse proxy →（可选用户 `httpProxy`）→ 自定义 host。  
   API key 以 `Authorization: Bearer` 经代理头传到上游。与 CLI `smm tmdb search --host … --password … --proxy …` 语义对齐。

2. **未配置 host（默认）**  
   浏览器 → Discover 下发的 TMDB 镜像 / 默认 `https://mediadb.vercel.app/api/tmdb`（可先经 Discover reverse proxy，再直连）。  
   搜索失败时 `fetchTmdbOrUndefined` 把 failover 耗尽转成 `undefined`，再走 `classifyTmdbError` 做用户可读错误；scrape / 拉详情等路径仍用 `fetchTmdb`，让 `HttpFailoverExhaustedError` 直接抛出。

### 与 CLI 的关系

- Web 搜索**不**调用 `smm tmdb search` 子命令。  
- 自定义 host 时共用同一套 CLI reverse proxy 转发能力。  
- 默认路径走浏览器侧 Discover + failover，与 CLI 直连 host/proxy 参数是平行实现。


## apps/core design

Core exposes TMDB search for CLI (and other in-process callers):

### `searchInTmdb(keyword, options)`

```ts
core.searchInTmdb(keyword, {
  type: "tv" | "movie",
  language?: string,   // CLI `--lang`; offline check vs packages/core/tmdbPrimaryTranslations.ts; default: preferMediaLanguage → OS → en-US
  host?: string,       // default: userConfig.tmdb.host
  password?: string,   // default: userConfig.tmdb.apiKey (CLI `--password`)
  proxy?: string,      // default: userConfig.tmdb.httpProxy (CLI `--proxy`)
})
```

- Builds `TmdbClient` with Core’s `NetworkPort` (CLI: `NodejsNetworkPort`).
- When `--lang` / `language` is set, validates offline against `TMDB_PRIMARY_TRANSLATIONS` (static snapshot of TMDB primary translations).
- Sets `reverseProxyUrl: null` so requests go **direct** through NetworkPort; `proxy` is passed as `FetchInit.proxy` (not `X-Http-Proxy` / reverse proxy).
- Returns `TmdbSearchResponseBody`.
