## Context

`apps/ui` currently talks to metadata APIs through existing CLI routes such as `/tmdb/*` and `/tvdb/*`, plus direct-mode headers for configured TMDB hosts. This avoids some browser restrictions but leaves the UI tied to route-specific proxy behavior and does not provide a general CORS-safe path for both TMDB and TVDB upstreams.

The new proxy should run in `apps/cli` as a localhost-only auxiliary server, separate from the main Hono application port. The UI discovers that server through the existing `hello` task and then sends metadata API requests to the proxy with `X-SMM-Proxy-Upstream-BaseURL` identifying the approved upstream base URL.

## Goals / Non-Goals

**Goals:**

- Start a standalone reverse proxy server on `127.0.0.1` using an available port from `30000` through `31000`.
- Forward requests to an allowlisted upstream base URL provided by `X-SMM-Proxy-Upstream-BaseURL`.
- Preserve method, path, query string, and body while filtering hop-by-hop headers and rewriting `Host` for the selected upstream.
- Expose the proxy base URL in `HelloResponseBody` so the UI can discover it without hard-coded ports.
- Update TMDB and TVDB API routing to use the discovered local proxy where appropriate.
- Keep forwarding logic unit-testable without requiring the full desktop app to run.

**Non-Goals:**

- This change does not add arbitrary internet proxying or user-editable upstream allowlists.
- This change does not replace TVDB token acquisition semantics unless a request continues to use the existing `/tvdb/*` route.
- This change does not change persisted user configuration formats.

## Decisions

### Use a dedicated localhost Bun server

The reverse proxy will be managed by a small CLI module that owns a `Bun.serve` instance. It will bind to `127.0.0.1` and select a random candidate port in the `30000` to `31000` range, retrying until a free port is found or the range is exhausted.

Alternative considered: register the proxy as another route on the main CLI server. That would be simpler, but it would not satisfy the standalone random-port requirement and would keep proxy lifecycle coupled to static asset/API routing.

### Publish proxy discovery through `executeHelloTask`

The proxy manager will expose its current address, and `executeHelloTask` will include it in the hello response as a new field such as `reverseProxyUrl`. This keeps discovery aligned with existing UI startup data that already includes directories and version information.

Alternative considered: add a new discovery endpoint. That would work, but it adds another API surface when the hello task is already the application bootstrap contract.

### Validate upstreams by parsed host

The proxy will parse `X-SMM-Proxy-Upstream-BaseURL` as a URL, then compare `url.hostname` against the fixed allowlist: `api.themoviedb.org`, `api4.thetvdb.com`, and `httpbin.io`. The upstream value may include a path prefix, so the forwarded URL is built by joining the upstream base path with the incoming request path and query.

Alternative considered: compare full URL prefixes. Host validation is less brittle for upstream base paths, while still preventing requests to unapproved domains.

### Filter proxy headers explicitly

Forwarded request and response headers will remove hop-by-hop headers such as `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`, `Transfer-Encoding`, and `Upgrade`. The upstream request `Host` header will be set from the upstream URL, and `X-SMM-Proxy-Upstream-BaseURL` will not be forwarded.

Alternative considered: forward headers unchanged. That risks incorrect connection semantics and leaks proxy control headers to upstream services.

### Reuse existing API clients with explicit proxy options

The UI TMDB/TVDB API clients should resolve a request target from user configuration and hello data. When using the local proxy, they send requests to the discovered proxy URL and include `X-SMM-Proxy-Upstream-BaseURL` for the selected allowlisted upstream. Existing direct-mode behavior should remain available when a user intentionally configures a direct host and required API credentials.

Alternative considered: hide all metadata requests behind existing CLI `/tmdb/*` and `/tvdb/*` routes. That preserves current routes, but it does not provide a shared proxy mechanism for both APIs.

## Risks / Trade-offs

- Port range exhaustion -> return no proxy URL from hello and log startup failure clearly so the UI can surface a meaningful metadata connectivity failure.
- SSRF through malformed upstream headers -> parse with `URL`, require `https:` for external upstreams, and enforce the hostname allowlist before forwarding.
- Header/body forwarding regressions -> cover forwarding behavior with unit tests that stub upstream responses and at least one integration-style test against `httpbin.io`.
- UI startup race with proxy startup -> start the proxy before hello data is relied on, and make hello read the manager's current URL rather than recomputing it.
- Duplicate TMDB proxy behavior during transition -> keep existing `/tmdb/*` behavior until UI routing has migrated, then consider cleanup in a separate change if desired.
