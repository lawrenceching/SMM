## Why

TMDB and TVDB access logic is duplicated across `apps/cli` and `apps/ui`: the CLI exposes legacy `/tmdb/*` and `/tvdb/*` routes that handle API-key/Authorization injection and TVDB login/token caching, while the UI also keeps direct-mode and proxy-mode branches. Now that the generic `external-api-reverse-proxy` exists, the CLI-side TMDB/TVDB plumbing is redundant and forces every routing/auth tweak to be made in two places. Consolidating all TMDB/TVDB access through the reverse proxy keeps auth and routing in a single layer (the UI), simplifying the CLI and the UI API clients.

## What Changes

- Migrate UI TMDB requests so they always go through the discovered reverse proxy (`X-SMM-Proxy-Upstream-BaseURL`), with the UI attaching `Authorization: Bearer <apiKey>` itself when a user-configured TMDB API key is present.
- Migrate UI TVDB requests so the browser-side TVDB v4 client performs `POST /login` against TVDB through the reverse proxy, caches the token in the UI process, and attaches `Authorization: Bearer <token>` to subsequent calls. When using the SMM-managed TVDB proxy upstream that does not require a token, no login/token is performed.
- **BREAKING (internal API):** Remove the legacy CLI HTTP routes `GET/POST /tmdb/*` (`apps/cli/src/route/TmdbProxy.ts`) and `GET/POST /tvdb/*` (`apps/cli/src/route/Tvdb.ts`), including TVDB token cache file handling.
- Remove the legacy `tmdbHost` / `X-TMDB-Host` / `X-TMDB-API-Key` header path in `apps/ui/src/api/tmdb.ts` and the `legacyBaseURL` overloads, leaving a single reverse-proxy-based code path.
- Update `apps/ui/src/lib/TvdbUtils.ts` so `getTVDBv4Client` always targets the reverse proxy and enables auth (`disableAuth: false`) when a TVDB API key is configured, otherwise stays on the SMM-managed TVDB proxy upstream without auth.
- Update tests (CLI, UI, e2e) to match the removal of `/tmdb/*` and `/tvdb/*` routes and the new UI-owned auth behavior.

## Capabilities

### New Capabilities

- `tmdb-ui-reverse-proxy-access`: Defines how the UI calls the TMDB API exclusively through the discovered reverse proxy, including how the user-configured TMDB host and API key are translated into `X-SMM-Proxy-Upstream-BaseURL` and `Authorization` headers.
- `tvdb-ui-reverse-proxy-access`: Defines how the UI calls the TVDB API exclusively through the discovered reverse proxy, including UI-side TVDB login, token caching, Authorization attachment, and the SMM-managed TVDB proxy fallback that skips login.

### Modified Capabilities

- `tmdb-api-proxy`: All requirements REMOVED — the CLI `/tmdb/*` route and its routing/Authorization-injection behavior no longer exist.
- `tmdb-endpoint-routing`: TMDB endpoint mode selection no longer has a "CLI `/tmdb` route" path; both empty-host and configured-host cases route through the discovered reverse proxy, differentiated only by the `X-SMM-Proxy-Upstream-BaseURL` value and whether the UI attaches `Authorization`.
- `external-api-reverse-proxy`: Upstream hostname allowlist is extended to include the SMM-managed default host (`tmdb-mcp-server.imlc.me`) so the reverse proxy can serve as the sole transport for both direct-upstream and SMM-managed-upstream TMDB/TVDB calls.

## Impact

- **CLI**: `apps/cli/server.ts` no longer registers `handleTmdbProxy` / `handleTvdb`; `apps/cli/src/route/TmdbProxy.ts`, `apps/cli/src/route/Tvdb.ts`, `apps/cli/src/route/TmdbProxy.test.ts`, and any `Tvdb.test.ts` are deleted. TVDB token cache file (`tvdb-token.txt`) is no longer written by the CLI.
- **UI**: `apps/ui/src/api/tmdb.ts` simplified to a single reverse-proxy code path; `apps/ui/src/lib/TvdbUtils.ts` (`getTVDBv4Client`) always uses the reverse proxy and reads TVDB API key from user config to drive login. New UI-side TVDB token cache (in-memory or `sessionStorage`) replaces the CLI-side file cache.
- **Allowlist**: The `external-api-reverse-proxy` allowlist must continue to permit `api.themoviedb.org` and `api4.thetvdb.com`; SMM-managed proxy endpoints (`tmdb-mcp-server.imlc.me`) must be added to the allowlist if they are still used as upstreams from the UI, or replaced with direct-upstream defaults.
- **Tests**: Update or remove `apps/cli/src/route/TmdbProxy.test.ts`, related TVDB CLI tests, and `apps/ui` tests that asserted the old `/tmdb/*` URL/header shape. Existing e2e specs for custom TMDB/TVDB host (`apps/e2e/test/specs/other/CustomTvdbHost.e2e.ts`, etc.) need adjustment.
- **User configuration**: Format unchanged (`tmdb`/`tvdb` host & apiKey fields stay), but the meaning of "host" becomes "upstream base URL forwarded via reverse proxy" rather than "host for CLI direct-mode forwarding".
