# Searchbox General Reverse Proxies — Design Spec

> Spec companion to the implementation plan. Decisions locked with the user on 2026-07-09.

## Decisions

1. **Order:** try local SMM reverse proxy first (`appConfig.reverseProxyUrl`), then remote `reverseProxies`.
2. **Upstream:** SMM-managed hosts only (`…/api/tmdb`, `…/api/tvdb`), not official TMDB/TVDB APIs.
3. **Approach:** dual-protocol header adapter (`local` vs `openresty`), not unify local proxy onto OpenResty headers in this change.
4. **Preference:** single `preferReverseProxyBaseUrl` for remotes (replaces `preferTmdbBaseUrl` / `preferTvdbBaseUrl` for Searchbox).

## Protocol (remote OpenResty)

From `reverse-proxy-readme.md`:

- Upstream: `X-Upstream-Base-Url`
- Auth: `X-Proxy-Authorization: Bearer {UTC yyyyMMdd}` when `authorizationMethod === 'date-token'`
- Do not use `Authorization` for proxy auth

## Protocol (local SMM)

- Upstream: `X-SMM-Proxy-Upstream-BaseURL`
- No OpenResty date-token

## Out of scope

Metadata queries, scrape, AI transport, database connection status — remain on local proxy only.

## Plan

`docs/superpowers/plans/2026-07-09-searchbox-reverse-proxies.md`
