## 1. Reverse Proxy Allowlist

- [x] 1.1 Add `tmdb-mcp-server.imlc.me` to `ALLOWED_UPSTREAM_HOSTS` in `apps/cli/src/proxy/reverseProxy.ts`.
- [x] 1.2 Update or add a unit test in the CLI proxy test suite that verifies an SMM-managed upstream host (`https://tmdb-mcp-server.imlc.me/api/tmdb` and `…/api/tvdb`) is forwarded successfully and that a non-allowlisted host is still rejected.

## 2. UI TMDB Client (single reverse-proxy code path)

- [x] 2.1 In `apps/ui/src/api/tmdb.ts`, introduce a `resolveTmdbUpstream(userConfig)` helper that returns `{ upstreamBaseURL, apiKey? }` based on `UserConfig.tmdb.host`/`apiKey` (falls back to the SMM-managed default upstream when host is empty).
- [x] 2.2 Refactor `searchTmdb`, `getTvShowById`, `getMovieById`, and `getSeason` so each builds the request URL as `${reverseProxyUrl}/<tmdb-path>?<query>` and sets headers `X-SMM-Proxy-Upstream-BaseURL: <upstreamBaseURL>` and (when configured) `Authorization: Bearer <apiKey>`. Drop the `X-TMDB-Host`/`X-TMDB-API-Key` headers and the `legacyBaseURL` overload.
- [x] 2.3 Throw a clear error from each TMDB API function when `reverseProxyUrl` is missing (no fallback to a CLI `/tmdb/*` route).
- [x] 2.4 Update `apps/ui/src/hooks/useTmdbQueries.ts` to feed the new options shape (e.g., pass `reverseProxyUrl`, `tmdbHost`, `tmdbApiKey` from user config + hello response). Ensure query keys do not include the raw API key (use a "hasApiKey" boolean).

## 3. UI TVDB Client (single reverse-proxy code path with login)

- [x] 3.1 In `apps/ui/src/lib/TvdbUtils.ts`, add a `resolveTvdbUpstream(userConfig)` helper returning `{ upstreamBaseURL, apiKey?, requiresAuth }` (SMM-managed default has `requiresAuth: false`; configured `api4.thetvdb.com` host has `requiresAuth: true`).
- [x] 3.2 Refactor `getTVDBv4Client(reverseProxyUrl, userConfig)` to always target the reverse proxy (`baseUrl: reverseProxyUrl`) and provide a `fetchImpl` that injects `X-SMM-Proxy-Upstream-BaseURL: <upstreamBaseURL>` on every request. Pass `apiKey` and `disableAuth: !requiresAuth || !apiKey` to the `TVDBv4` client so login is performed only when needed.
- [x] 3.3 Add module-level memoization for `getTVDBv4Client` keyed by `(reverseProxyUrl, upstreamBaseURL, apiKey)` so the in-process token cache inside `TVDBv4` is preserved across calls.
- [x] 3.4 Throw a clear error from `getTVDBv4Client` when `reverseProxyUrl` is missing (no fallback to a `${window.location}/tvdb` URL).
- [x] 3.5 Update `apps/ui/src/hooks/useTvdbQueries.ts` to source `reverseProxyUrl` and `userConfig.tvdb` for client construction, and to thread the resolved config into `fetchTvdbAndBuildTvShowMediaMetadata` / `fetchTvdbAndBuildMovieMediaMetadata`.

## 4. CLI Cleanup

- [x] 4.1 Remove `handleTmdbProxy(this.app)` and `handleTvdb(this.app)` registrations from `apps/cli/server.ts` (and remove their imports).
- [x] 4.2 Delete `apps/cli/src/route/TmdbProxy.ts` and `apps/cli/src/route/TmdbProxy.test.ts`.
- [x] 4.3 Delete `apps/cli/src/route/Tvdb.ts` (and any TVDB CLI test file). Remove TVDB token cache file logic and helpers (`tvdbTokenCacheFilePath`, etc.).
- [x] 4.4 Grep the CLI for any remaining `/tmdb` or `/tvdb` route references and remove dead code (e.g., commented `handleTmdb` registration on `apps/cli/server.ts:226`).

## 5. UI Test Updates

- [x] 5.1 Update `apps/ui/src/api/tmdb.test.ts` (and any related tests) to assert: request URL is `${reverseProxyUrl}/<path>`, `X-SMM-Proxy-Upstream-BaseURL` is set correctly, `Authorization` header presence depends on `UserConfig.tmdb.apiKey`, and there is no `X-TMDB-Host`/`X-TMDB-API-Key` header.
- [x] 5.2 Add a UI test that asserts TVDB login is sent through the reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` set and that subsequent calls reuse the cached token (no second login request).
- [x] 5.3 Add a UI test that asserts no login is performed when `UserConfig.tvdb.apiKey` is empty and the upstream is the SMM-managed default.
- [x] 5.4 Update `apps/ui/src/lib/TvdbUtils.test.ts` (and any related TVDB-related UI tests) to match the new client construction and error-on-missing-reverse-proxy behavior.
- [x] 5.5 Update any UI tests that previously stubbed `${window.location.origin}/tmdb/...` or `${window.location.origin}/tvdb/...` to stub the reverse proxy URL instead.

## 6. CLI Test Updates

- [x] 6.1 Remove or migrate `apps/cli/src/route/TmdbProxy.test.ts` (no `/tmdb/*` route to test).
- [x] 6.2 Remove or migrate any TVDB CLI route tests that targeted `/tvdb/*` (no route to test).
- [x] 6.3 Run the affected CLI test suite (`pnpm test:cli`) to confirm there are no remaining references to the removed routes.

## 7. E2E Test Updates

- [x] 7.1 Review `apps/e2e/test/specs/other/CustomTvdbHost.e2e.ts` and update assertions to match the reverse-proxy-based flow (TVDB host configured + API key drives upstream + Authorization at the UI layer).
- [x] 7.2 Review any e2e specs that mock or stub `/tmdb/*` or `/tvdb/*` (in `apps/e2e/test/lib/testbed.ts` or component objects) and migrate them to mock the reverse proxy URL.
- [-] 7.3 Run the targeted e2e specs (`pnpm run wdio --spec ./test/specs/other/CustomTvdbHost.e2e.ts` and any TMDB recognition specs). _Skipped: WebDriver-based e2e tests require the Electron app to be running; out of scope for this CLI session. Should be validated locally before archiving._

## 8. Verification

- [x] 8.1 Run `pnpm typecheck`. _Verified: no new typecheck errors introduced by this change. All remaining errors are pre-existing baseline issues unrelated to the reverse-proxy migration._
- [x] 8.2 Run `pnpm test`. _Verified: all CLI tests pass; all UI tests modified or added by this change pass (24 in `tmdb.test.ts`, 10 in `TvdbUtils.test.ts`, 3 in new `TvdbReverseProxy.test.ts`). 10 pre-existing UI test failures (`MusicHeaderV2.test.tsx`, `useInitializeImportedMediaFolder.test.ts`) confirmed to be unrelated baseline issues by re-running on stashed state._
- [-] 8.3 Run the targeted e2e specs from task 7.3. _Skipped: WebDriver-based e2e tests require the Electron app to be running; out of scope for this CLI session._
- [-] 8.4 Manually verify in dev mode (`pnpm dev`) that TMDB search and TVDB search work both with and without configured `tmdb.host`/`tvdb.host` and `apiKey`. _Skipped: requires manual interactive verification in the running app._
- [x] 8.5 Run `openspec status --change access-tmdb-and-tvdb-via-reverse-proxy` and confirm the change is apply-ready.
