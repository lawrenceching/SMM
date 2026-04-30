## 1. CLI Reverse Proxy Server

- [x] 1.1 Add a reverse proxy module in `apps/cli` that starts a `Bun.serve` instance bound to `127.0.0.1`.
- [x] 1.2 Implement random port selection and retry logic for the inclusive `30000` to `31000` port range.
- [x] 1.3 Implement upstream URL parsing, path/query joining, and validation for `X-SMM-Proxy-Upstream-BaseURL`.
- [x] 1.4 Enforce the upstream hostname allowlist for `api.themoviedb.org`, `api4.thetvdb.com`, and `httpbin.io`.
- [x] 1.5 Implement request forwarding that preserves method, query, and body while removing proxy control and hop-by-hop request headers.
- [x] 1.6 Implement response forwarding that preserves status/body and filters hop-by-hop response headers.
- [x] 1.7 Start and stop the reverse proxy from the CLI server lifecycle.

## 2. Proxy Discovery

- [x] 2.1 Extend the shared hello response type with the reverse proxy base URL field.
- [x] 2.2 Update `executeHelloTask` to return the active reverse proxy URL.
- [x] 2.3 Ensure hello responses are stable when the reverse proxy fails to start and log the failure clearly.

## 3. UI Metadata Routing

- [x] 3.1 Update UI bootstrap/query code so API clients can access the hello-discovered reverse proxy URL.
- [x] 3.2 Update TMDB API routing to use the local reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` when TMDB host is empty.
- [x] 3.3 Preserve existing TMDB direct-mode behavior when a custom TMDB host and API key are configured.
- [x] 3.4 Add or update TVDB API routing to use the local reverse proxy for allowlisted TVDB upstream requests.

## 4. Tests

- [x] 4.1 Add CLI unit tests for successful forwarding to an allowlisted upstream.
- [x] 4.2 Add CLI unit tests for missing, malformed, and non-allowlisted upstream header rejection.
- [x] 4.3 Add CLI unit tests for hop-by-hop header removal and upstream `Host` header rewriting.
- [x] 4.4 Add CLI tests for random port discovery and hello task proxy URL exposure.
- [x] 4.5 Update E2E coverage for custom TMDB and TVDB host behavior that depends on reverse proxy discovery.

## 5. Verification

- [x] 5.1 Run the affected CLI test suite.
- [x] 5.2 Run the affected UI tests or typecheck for metadata API routing changes.
- [x] 5.3 Run targeted E2E specs for custom TMDB and TVDB host behavior.
- [x] 5.4 Run `openspec status --change reverse-proxy` and confirm the change is apply-ready.
