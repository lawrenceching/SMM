## Why

The SMM web UI cannot reliably call TMDB and TVDB APIs directly because browser CORS policy blocks those requests. A local CLI-owned reverse proxy lets the desktop app reach approved external metadata APIs while keeping browser requests same-origin to a trusted local service.

## What Changes

- Add a standalone reverse proxy server in `apps/cli` that listens on a random localhost port in the `30000` to `31000` range.
- Forward incoming proxy requests to the upstream base URL provided by `X-SMM-Proxy-Upstream-BaseURL`, preserving request method, path, query, body, and appropriate headers.
- Restrict upstream hosts to an allowlist containing `api.themoviedb.org`, `api4.thetvdb.com`, and `httpbin.io`.
- Expose the active reverse proxy address through the CLI hello task so `apps/ui` can discover it at runtime.
- Update UI metadata API routing so TMDB and TVDB requests can use the discovered local proxy address when direct browser access is blocked.
- Add tests covering forwarding behavior, hop-by-hop header removal, host header rewriting, allowlist rejection, and proxy discovery.

## Capabilities

### New Capabilities

- `external-api-reverse-proxy`: Defines the CLI-managed reverse proxy used by the UI to access approved external metadata APIs.

### Modified Capabilities

- `tmdb-endpoint-routing`: TMDB routing must support runtime discovery of the local reverse proxy address instead of relying only on a fixed SMM proxy endpoint or direct configured host.
- `tmdb-api-proxy`: TMDB proxy behavior must align with the generic reverse proxy contract when TMDB requests are routed through the new local proxy.

## Impact

- Affects `apps/cli` startup/server lifecycle, proxy request handling, and `apps/cli/tasks/HelloTask.ts`.
- Affects `apps/ui` API client routing for TMDB and TVDB calls.
- Adds or updates automated tests in CLI test coverage and existing E2E coverage for custom TMDB/TVDB hosts.
- No breaking changes are intended for existing user configuration or metadata workflows.
