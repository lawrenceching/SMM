## Context

当前项目中 `apps/import/tmdb/fetch-tmdb-tv-series.ts` 使用硬编码的 SMM 代理地址 (`https://tmdb-mcp-server.imlc.me/api/tmdb`) 访问 TMDB API. 浏览器端代码若直接请求 TMDB 官方 API (`api.themoviedb.org`) 会因 CORS 策略失败. 项目需要在 `apps/cli` 中提供统一的 TMDB API 代理. 由于 `apps/cli` 本身就是网页的前端服务器, 浏览器与代理同源, 不存在跨域问题, 无需额外 CORS 配置.

本项目使用 Bun 作为 TypeScript 运行时, pnpm 作为包管理器, 采用 monorepo 结构 (`apps/*`, `packages/*`).

## Goals / Non-Goals

**Goals:**
- 在 `apps/cli` 中提供 HTTP 代理端点, 浏览器通过此代理访问 TMDB API
- 通过 `X-TMDB-Host` 请求头动态选择上游: 官方 API 或 SMM 代理
- 通过 `X-TMDB-API-Key` 请求头传递 TMDB API 认证凭据
- 代理透传请求路径、查询参数和请求体到上游

**Non-Goals:**
- 不修改现有 `apps/import/tmdb/fetch-tmdb-tv-series.ts` 的 TMDB 调用方式
- 不实现请求缓存
- 不实现速率限制 (rate limiting)

## Decisions

### 1. 使用 Bun.serve 作为 HTTP 服务器

**选择**: 使用 Bun 内置的 `Bun.serve()` API 启动 HTTP 服务.

**理由**: 项目已使用 Bun 作为 TypeScript 运行时, 无需额外依赖 Express 或 Hono 等框架. Bun.serve 提供足够的 HTTP 路由和中间件能力, 零额外依赖.

**替代方案**: Express/Hono — 增加依赖, 对简单的代理场景过度设计.

### 2. 通过自定义请求头控制路由

**选择**: 使用 `X-TMDB-Host` 和 `X-TMDB-API-Key` 两个自定义请求头.

- `X-TMDB-Host`: 指定上游主机地址 (如 `api.themoviedb.org`). 当此头配置时, 代理请求到该地址; 未配置时使用默认的 SMM 代理 `https://tmdb-mcp-server.imlc.me`.
- `X-TMDB-API-Key`: TMDB API 认证 Token (Bearer), 代理将其作为 `Authorization: Bearer <token>` 转发到上游.

**理由**: 自定义请求头是最简单的路由控制方式, 浏览器 `fetch()` 可直接设置. 无需额外的 URL 路径约定或查询参数.

### 3. SMM 代理需额外 `/api/tmdb` 前缀

**选择**: 当路由到 SMM 代理 (`https://tmdb-mcp-server.imlc.me`) 时, 请求路径前自动添加 `/api/tmdb` 前缀.

示例: 浏览器请求 `/3/tv/123?language=en-US` → SMM 代理请求 `/api/tmdb/3/tv/123?language=en-US`

当路由到官方 API 时, 请求路径保持原样, 不添加前缀.

**理由**: SMM 代理的 `/api/tmdb` 是其自身的路由前缀, 不是 TMDB API 规范的一部分. 官方 TMDB API 路径为 `/3/tv/{id}`, 不需要此前缀.

### 4. 无需 CORS 配置

**选择**: 代理不设置 CORS 响应头.

**理由**: `apps/cli` 本身就是网页的前端服务器, 浏览器请求代理与请求页面同源, 不存在跨域限制. 设置 CORS 头是多余的.

## Risks / Trade-offs

- **[风险] 代理暴露 TMDB API Key**: 浏览器端需在请求头中传递 `X-TMDB-API-Key`, 若前端代码公开, Token 可能泄露. → 可后续考虑服务端注入 Token 而非通过客户端传递.
- **[风险] 代理成为单点故障**: 若 `apps/cli` 不可用, 所有 TMDB API 请求失败. → 代理不负责数据存储, 重启即可恢复.
- **[权衡] 无鉴权**: 代理未对客户端实施鉴权. → 当前阶段代理仅在内部网络使用, 后续可按需添加.
