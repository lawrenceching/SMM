## ADDED Requirements

### Requirement: TMDB API Proxy accepts and routes requests

代理服务 SHALL 接受 HTTP 请求, 基于 `X-TMDB-Host` 请求头将请求转发到对应的上游 TMDB API 服务器, 并将上游响应透传给客户端.

#### Scenario: Request routed to official TMDB API when X-TMDB-Host is set

- **WHEN** 客户端发送请求, 且设置了 `X-TMDB-Host: api.themoviedb.org` 请求头
- **THEN** 代理将请求转发到 `https://api.themoviedb.org`, 路径和查询参数保持原样, 不添加 `/api/tmdb` 前缀

#### Scenario: Request routed to SMM proxy when X-TMDB-Host is not set

- **WHEN** 客户端发送请求, 且未设置 `X-TMDB-Host` 请求头
- **THEN** 代理将请求转发到 `https://tmdb-mcp-server.imlc.me`, 并在路径前添加 `/api/tmdb` 前缀

### Requirement: TMDB API Proxy forwards X-TMDB-API-Key as Authorization

代理服务 SHALL 读取 `X-TMDB-API-Key` 请求头, 并将其作为 `Authorization: Bearer <value>` 请求头发送给上游 TMDB API.

#### Scenario: X-TMDB-API-Key is provided

- **WHEN** 客户端请求包含 `X-TMDB-API-Key: abc123` 请求头
- **THEN** 代理向上游请求添加 `Authorization: Bearer abc123` 请求头

#### Scenario: X-TMDB-API-Key is not provided

- **WHEN** 客户端请求不包含 `X-TMDB-API-Key` 请求头
- **THEN** 代理向上游请求不添加 `Authorization` 请求头

### Requirement: TMDB API Proxy preserves request method, path, query, and body

代理服务 SHALL 保持客户端请求的 HTTP 方法、路径、查询参数和请求体不变, 仅根据路由规则修改目标地址和路径前缀.

#### Scenario: GET request with query parameters is proxied

- **WHEN** 客户端发送 `GET /3/tv/123?language=en-US` 请求
- **AND** `X-TMDB-Host: api.themoviedb.org`
- **THEN** 代理向上游发送 `GET https://api.themoviedb.org/3/tv/123?language=en-US`

#### Scenario: POST request with body is proxied

- **WHEN** 客户端发送 `POST /3/search/tv` 请求, 请求体为 JSON
- **AND** `X-TMDB-Host` 未设置
- **THEN** 代理向上游发送 `POST https://tmdb-mcp-server.imlc.me/api/tmdb/3/search/tv`, 请求体保持一致
