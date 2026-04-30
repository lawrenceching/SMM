## Context

The previous `reverse-proxy` change introduced a generic localhost reverse proxy in `apps/cli` (`apps/cli/src/proxy/reverseProxy.ts`) that forwards browser requests to allowlisted external upstreams (`api.themoviedb.org`, `api4.thetvdb.com`, `httpbin.io`) based on the `X-SMM-Proxy-Upstream-BaseURL` header. It was added side-by-side with the existing CLI HTTP routes:

- `apps/cli/src/route/TmdbProxy.ts`: routes `/tmdb/*` to either TMDB or `tmdb-mcp-server.imlc.me/api/tmdb`, injecting `Authorization: Bearer <X-TMDB-API-Key>`.
- `apps/cli/src/route/Tvdb.ts`: routes `/tvdb/*`, performing TVDB v4 `POST /login`, caching the token to a file (`tvdb-token.txt`), and attaching `Authorization: Bearer <token>` on subsequent calls. When configured to use `tmdb-mcp-server.imlc.me/api/tvdb`, login is skipped.

The UI (`apps/ui/src/api/tmdb.ts`, `apps/ui/src/lib/TvdbUtils.ts`, `apps/ui/src/hooks/useTmdbQueries.ts`, `apps/ui/src/hooks/useTvdbQueries.ts`) currently has three branches per call: direct mode (`X-TMDB-Host` + `X-TMDB-API-Key` headers handed to the CLI route), reverse-proxy mode (using the discovered `reverseProxyUrl`), and a legacy `baseURL` fallback. This duplication makes auth/routing changes risky and obscures intent.

This change retires the CLI-side TMDB/TVDB plumbing and centralizes auth in the UI, leaving a single code path: every TMDB/TVDB request is routed through the discovered reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` and (when needed) a UI-attached `Authorization: Bearer …` header.

## Goals / Non-Goals

**Goals:**

- Single TMDB code path in the UI: always send through the reverse proxy with explicit `X-SMM-Proxy-Upstream-BaseURL` and `Authorization` (when a TMDB API key is configured).
- Single TVDB code path in the UI: always go through the reverse proxy; UI performs TVDB login when a TVDB API key is configured, caches the token in-process, and attaches `Authorization: Bearer <token>`.
- Remove `apps/cli/src/route/TmdbProxy.ts` and `apps/cli/src/route/Tvdb.ts` (and their registrations and tests). Remove the CLI-side TVDB token cache file.
- Keep the SMM-managed default upstream usable when the user has not configured a TMDB/TVDB API key.
- Preserve current behavior for users with custom TMDB/TVDB hosts (e.g., self-hosted mirrors) by routing those custom hosts through the reverse proxy with their API key.

**Non-Goals:**

- Do not change the proposal/format of `UserConfig.tmdb` / `UserConfig.tvdb` (still `{ host?: string; apiKey?: string }`).
- Do not change the reverse-proxy port range, hop-by-hop filtering, or `Host` rewriting rules.
- Do not redesign the TVDB v4 client surface (`packages/tvdb4`); only how it is constructed and configured from the UI.
- Do not introduce new persisted browser storage if not required (in-memory cache is sufficient; persistence is a follow-up if desired).

## Decisions

### Centralize TMDB upstream + Authorization construction in the UI

The UI resolves a single `{ upstreamBaseURL, apiKey }` pair from `UserConfig.tmdb` plus a built-in default:

- If `UserConfig.tmdb.host` is non-empty: `upstreamBaseURL = normalizeTmdbHost(host)` (e.g., ensure `/3` suffix), `apiKey = UserConfig.tmdb.apiKey`.
- Otherwise: `upstreamBaseURL = SMM_TMDB_DEFAULT_UPSTREAM` (e.g., `https://tmdb-mcp-server.imlc.me/api/tmdb` or another approved default), `apiKey = undefined`.

All TMDB requests are sent to `${reverseProxyUrl}/<tmdb-path>` with headers:

- `X-SMM-Proxy-Upstream-BaseURL: <upstreamBaseURL>`
- `Authorization: Bearer <apiKey>` only when `apiKey` is defined.

Alternative considered: keep the `X-TMDB-Host` / `X-TMDB-API-Key` indirection. Rejected because that requires a CLI translator to build `Authorization`, defeating the goal of removing CLI-side TMDB plumbing.

### Centralize TVDB login + token caching in the UI

The UI builds a single `TVDBv4` client per `(reverseProxyUrl, upstreamBaseURL, apiKey)` triple, memoized in a module-level `Map`. The client targets the reverse proxy and uses a custom `fetchImpl` that injects `X-SMM-Proxy-Upstream-BaseURL` on every request.

- When `UserConfig.tvdb.apiKey` is non-empty and `upstreamBaseURL` points at a TVDB host that requires auth (e.g., `api4.thetvdb.com/v4`), construct the client with `disableAuth: false` so it performs `POST /login` (still routed through the reverse proxy) and reuses the token in-process.
- When `apiKey` is empty and `upstreamBaseURL` points at the SMM-managed TVDB proxy (`tmdb-mcp-server.imlc.me/api/tvdb`) which does not require auth, construct the client with `disableAuth: true` (current default) so no login is attempted.
- Token cache: rely on the existing in-process token cache inside `TVDBv4` (`this.token`, `this.tokenExpiresAt`). Memoizing the client across calls preserves that cache for the app session. No filesystem cache.

Alternative considered: persist the token in `localStorage`/`sessionStorage` to survive reloads. Rejected for now — adds storage hygiene complexity and the desktop app rarely reloads. Can be added in a follow-up if needed.

Alternative considered: keep CLI-side `Tvdb.ts` and only delete `TmdbProxy.ts`. Rejected — defeats the consolidation goal and leaves duplicated patterns.

### Allowlist update

The reverse proxy allowlist (`ALLOWED_UPSTREAM_HOSTS` in `apps/cli/src/proxy/reverseProxy.ts`) must include any host the UI can target as an upstream. After this change the UI may target:

- `api.themoviedb.org` (TMDB direct).
- `api4.thetvdb.com` (TVDB direct).
- `tmdb-mcp-server.imlc.me` (SMM-managed default for both TMDB and TVDB) — must be added.
- `httpbin.io` (kept for tests).

Alternative considered: drop the SMM-managed default and require all users to bring their own TMDB/TVDB API key. Rejected — the SMM-managed default is the current zero-config UX baseline.

### Single UI code path; remove legacy direct-mode branches

`apps/ui/src/api/tmdb.ts` is collapsed to one path that always uses `reverseProxyUrl` + `X-SMM-Proxy-Upstream-BaseURL`. Overloads/parameters such as `legacyBaseURL`, `tmdbHost`, `tmdbApiKey` (in their old "send to CLI route" sense) are dropped or repurposed to feed the upstream/Authorization derivation described above. `apps/ui/src/lib/TvdbUtils.ts` `getTVDBv4Client` no longer has a fallback to `${window.location}/tvdb`.

Alternative considered: keep CLI routes as a fallback when `reverseProxyUrl` is unavailable. Rejected — if the reverse proxy fails to start, the UI should surface that error rather than silently fall back to a route that no longer exists.

### Removal of CLI routes is a clean delete (no compatibility window)

`/tmdb/*` and `/tvdb/*` are internal endpoints consumed only by `apps/ui` in this monorepo. They are removed in the same change as the UI migration, plus their tests and TVDB token cache file usage. `getAppDataDir`/`getUserDataDir` references for TVDB token caching are removed.

Alternative considered: keep routes for one release, mark them deprecated. Rejected — internal-only API, simpler to delete in lockstep.

## Risks / Trade-offs

- **Reverse proxy allowlist must be widened to include `tmdb-mcp-server.imlc.me`.** → Update `ALLOWED_UPSTREAM_HOSTS` and the `external-api-reverse-proxy` spec; add proxy unit test for the new allowlist entry.
- **TVDB token is no longer persisted across UI reloads.** → Acceptable for the app's session model; if it becomes an issue, add `sessionStorage`/`localStorage` token cache as a follow-up.
- **Login traffic now traverses the local reverse proxy in addition to the upstream.** → The proxy already preserves bodies and headers; covered by existing `external-api-reverse-proxy` requirements; add a UI test that verifies the login `POST` is routed through the proxy.
- **CORS / preflight for `Authorization` header on the local proxy.** → The proxy's existing `Access-Control-Allow-Headers: *` already permits it; verify with a unit test that exercises a preflight + `Authorization` request.
- **Hidden coupling between UI and CLI routes**: removing `/tmdb/*` and `/tvdb/*` may break code paths discovered late. → Grep + typecheck + targeted e2e (`CustomTvdbHost.e2e.ts`, TMDB recognition specs) before merging.
- **Concurrency on TVDB login**: `TVDBv4` already has `loginInFlight` deduplication, but only per client instance. → The memoized-by-key client preserves deduplication; tested via existing `packages/tvdb4` tests.
- **Breaking change for any external integration** that consumed `/tmdb/*` or `/tvdb/*` directly. → None known in this repo; documented as BREAKING in the proposal.

## Migration Plan

1. Add `tmdb-mcp-server.imlc.me` (and any other still-used SMM-managed hosts) to `ALLOWED_UPSTREAM_HOSTS` and update the `external-api-reverse-proxy` spec/tests.
2. Update `apps/ui/src/api/tmdb.ts` to a single reverse-proxy code path with explicit upstream + Authorization derivation. Drop legacy parameters.
3. Update `apps/ui/src/lib/TvdbUtils.ts` (`getTVDBv4Client`) to always target the reverse proxy and turn on auth (`disableAuth: false`) when an API key is configured and the upstream requires auth. Memoize per `(reverseProxyUrl, upstreamBaseURL, apiKey)`.
4. Update `apps/ui/src/hooks/useTmdbQueries.ts` and `apps/ui/src/hooks/useTvdbQueries.ts` to feed the new derivation; ensure query keys include the upstream and a "has API key" boolean (no raw key).
5. Remove `handleTmdbProxy(this.app)` and `handleTvdb(this.app)` registrations from `apps/cli/server.ts`. Delete `apps/cli/src/route/TmdbProxy.ts`, `apps/cli/src/route/TmdbProxy.test.ts`, `apps/cli/src/route/Tvdb.ts`, and any TVDB CLI tests. Remove TVDB token cache file usage.
6. Update CLI tests (no `/tmdb/*` endpoint), UI tests (no `X-TMDB-Host`/`X-TMDB-API-Key` assertions), and e2e specs (`CustomTvdbHost.e2e.ts`, etc.) to match the new behavior.
7. Run `pnpm test`, `pnpm typecheck`, and the affected e2e specs.

Rollback: revert the change set. Because routes and UI code change together, partial rollback is not supported; the change is reverted as a whole.

## Open Questions

- Should the SMM-managed default upstream remain `tmdb-mcp-server.imlc.me/api/tmdb` and `…/api/tvdb`, or should the new default be `api.themoviedb.org/3` / `api4.thetvdb.com/v4` with a built-in shared API key? **Assumption for this design**: keep the SMM-managed defaults; do not embed an SMM API key in the desktop app.
- Should the TVDB token also be cached in `sessionStorage` to survive UI reloads inside the same Electron session? **Assumption**: not in this change; keep in-memory only.
