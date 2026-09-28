# Path-mounted reverse proxy (`/proxy`)

## 1. Background

SMM previously ran the L7 reverse proxy (TMDB / TVDB / AI upstream forwarding) on a **separate TCP port** (scan range 30000–31000). That let clients swap only `baseUrl`, but forced:

1. An extra published Docker port
2. Cross-origin traffic (CORS) for Web UI / Electron / HarmonyOS

## 2. Architecture

### 2.1 Project Level Architecture

Same proxy semantics (`X-SMM-Proxy-Upstream-BaseURL` + upstream allowlist) live in `@smm/core-routes`. Hosts mount it on the **unified HTTP server**:

| Host | Mount |
|------|--------|
| `apps/cli` | Hono route `/proxy` + `/proxy/*` on the main listen port |
| `apps/ohos` | Node `http` dispatch for `/proxy` on `MAIN_HTTP_PORT` |
| `apps/ui` (Vite dev) | Dev-server proxy `/proxy` → CLI origin |

`HelloResponseBody.reverseProxyUrl` advertises `http://<advertised-host>:<main-port>/proxy`.

### 2.2 App Level Architecture

1. `handleProxyRequest` optionally strips `stripPathPrefix` (e.g. `/proxy`) from the incoming pathname before building the upstream URL.
2. CLI / ohos stop opening a dedicated `http.Server` for the proxy in production; unit tests may still use `createReverseProxyManager` standalone (no path prefix).
3. UI / SDK clients keep replacing `baseUrl` with `reverseProxyUrl`; paths append under `/proxy/...`.

### 2.3 Key Design

- Constant: `REVERSE_PROXY_MOUNT_PATH = "/proxy"`
- Control header unchanged: `X-SMM-Proxy-Upstream-BaseURL`
- Auth: `/proxy` stays outside `/api/*` bearer middleware (same openness as the old dedicated port)
- Same-origin with the UI eliminates the Docker second-port and CORS tax for normal Web / Electron / ohos UI loads

## 3. User Stories

### 3.1 Browser TMDB via same origin

* **Given** - Web UI is served from `http://host:30000`
* **When** - UI calls TMDB through `reverseProxyUrl` (`http://host:30000/proxy`)
* **Then** - Request is same-origin; no extra port mapping; upstream path has `/proxy` stripped
