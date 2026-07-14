# Media Database

媒体数据库搜索框的全语言支持、本地化名称显示、服务发现与可达性检测。

## 1. Searchbox: All Languages

`MediaDatabaseSearchbox` 语言下拉框支持全部 TMDB (144 种) 和 TVDB (185 种) 语言，并持久化用户偏好。

### 1.1 Code Formats

| Database | Format | Example |
|----------|--------|---------|
| TMDB | IETF BCP 47 | `zh-CN`, `en-US`, `fr-FR` |
| TVDB | ISO 639-3 | `zho`, `eng`, `fra` |

`PreferMediaLanguage` (3-value union) 用于 `UserConfig` 保持不变。搜索语言使用 `string` 宽类型，与 `PreferMediaLanguage` 解耦。

### 1.2 Architecture

```
MediaDatabaseSearchbox → searchLanguage: string
  ├── TMDB: useTmdbSearchLanguageOptions() → GET /3/configuration/primary_translations
  ├── TVDB: useTvdbSearchLanguageOptions() → TVDBv4.getLanguages()
  ├── Persistence: localStorage (lastSelectedTmdbLanguage / lastSelectedTvdbLanguage)
  └── Fallback: localStorage → userConfig.preferMediaLanguage → en-US/eng
```

**ImmersiveSearchbox** 移除硬编码 `SUPPORTED_MEDIA_LANGUAGES`，改为接收 `searchLanguageOptions: Array<{code, name}>` prop + `showAllLanguages` toggle。

**UI 行为**：
- 默认显示 3 个优先语言 + "显示全部语言" 底部项
- 点击 "显示全部" → 3 个优先语言置顶，其余追加，底部变为 "收起"
- 展开状态仅当前会话有效，关闭 popover 即重置
- **不修改** collapsed trigger 值行为（Radix `SelectItem` 查找不变）

### 1.3 Persistence Priority

`localStorage.lastSelectedTmdbLanguage` → `userConfig.preferMediaLanguage` (映射) → `en-US`/`eng`

## 2. Native Language Names

使用原生语言名称代替 API 英文名称，纯 UI 层改动。

**Before**: `Mandarin (zh-CN)`, `Chinese - China (zho)`  
**After**: `中文 (zh-CN)`, `中文 (zho)`

### 2.1 Implementation

`apps/ui/src/lib/languageNativeNames.ts`:
- `LANGUAGE_NATIVE_NAMES: Map<string, string>` — 30 种语言，支持 3 种代码格式
- `getLanguageDisplayName(code, apiEnglishName?) → string`
  1. 查表 → 原生名称
  2. 回退 → API 英文名
  3. 回退 → 原始代码

集成到 `useTmdbSearchLanguageOptions` 和 `useTvdbSearchLanguageOptions`。

## 3. Service Discovery & Reachability

从远端配置发现 **通用 OpenResty reverseProxies**，可达性检测选择最快远端；Searchbox 搜索时 **本地 SMM 反向代理优先**，再回退到远端。

### 3.1 Architecture (Decoupled)

```
main.tsx (vanilla JS bootstrap)
  └─ startReverseProxyServiceDiscovery()
      ├─ fetch GET /api/discover → reverseProxies
      ├─ probeReverseProxyReachability() × N   ← OpenResty 头 + SMM TMDB upstream
      └─ localStorages.preferReverseProxyBaseUrl

App (React)
  └─ useReverseProxyBaseUrls()
       order: local appConfig.reverseProxyUrl → preferred remote → other remotes
  └─ MediaDatabaseSearchbox
       ├─ local: X-SMM-Proxy-Upstream-BaseURL
       └─ openresty: X-Upstream-Base-Url + X-Proxy-Authorization (UTC yyyyMMdd)
```

### 3.2 Key Design Decisions

- **纯 JS 函数**，在 `main.tsx` 启动时直接调用，不依赖 React 生命周期
- **模块级 guard** `hasStartedThisSession` 防止重复
- **失败静默** — 探测失败不影响应用
- **发布订阅** (`subscribeToDiscovery`) 供 React hook 在探测完成后更新
- **双协议**：本地 SMM 代理与远端 OpenResty 头字段不同（见 `reverse-proxy-readme.md`）
- Upstream 固定为 SMM 托管 `…/api/tmdb` / `…/api/tvdb`
- 旧的 per-type `preferTmdbBaseUrl` / `preferTvdbBaseUrl` 与 `mediaDatabases` direct 搜索路径已移除

### 3.3 Data Flow

```
/api/discover → reverseProxies[{ id, type, url, authorizationMethod }]
  → probe (OpenResty) × 3 次/URL
  → 选取最快 → preferReverseProxyBaseUrl

Searchbox → useReverseProxyBaseUrls()
  → [local, preferred, ...remotes]
  → searchTmdb / getTVDBv4Client(proxyKind)
```
