## Why

浏览器端代码直接访问 TMDB 官方 API (`api.themoviedb.org`) 时报 CORS 错误, 因为 TMDB 官方 API 不支持跨域请求. 同时, 后端脚本 (`fetch-tmdb-tv-series.ts`) 通过 SMM 代理 (`tmdb-mcp-server.imlc.me`) 访问 TMDB 时使用硬编码地址, 缺乏灵活性. 本次改动将浏览器请求统一通过 `apps/cli` 代理转发, 解决 CORS 问题并提供可配置的路由能力.

## What Changes

- 在 `apps/cli` 中新增 TMDB API 代理端点, 浏览器通过此代理访问 TMDB 数据
- 通过自定义请求头 `X-TMDB-Host` 和 `X-TMDB-API-Key` 控制代理路由:
  - 当 `X-TMDB-Host` 配置时, 将请求代理到指定的 TMDB 主机地址 (官方 API)
  - 当 `X-TMDB-Host` 未配置时, 将请求代理到 SMM 的 TMDB 代理服务器 (`https://tmdb-mcp-server.imlc.me/api/tmdb`)
- SMM 代理服务器的 `/api/tmdb` 前缀仅适用于 SMM 代理, 官方地址路由时不附加此前缀

## Capabilities

### New Capabilities

- `tmdb-api-proxy`: 在 `apps/cli` 中提供 TMDB API 代理 HTTP 服务, 支持通过请求头动态路由到官方 API 或 SMM 代理

### Modified Capabilities

<!-- No existing specs are modified -->

## Impact

- 新增 `apps/cli` 应用 (如尚未存在则创建, 如已存在则扩展现有 HTTP 服务)
- 浏览器端需修改 TMDB API 调用代码, 将请求目标从 `api.themoviedb.org` 改为 `apps/cli` 的代理地址
- 后端脚本 (`apps/import/tmdb/fetch-tmdb-tv-series.ts`) 可后续复用此代理机制, 但目前不受影响
