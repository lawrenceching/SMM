# Searchbox → General Reverse Proxies

`MediaDatabaseSearchbox` currently discovers and calls **per-database** endpoints from `/api/discover` → `mediaDatabases` (direct HTTP to `…/api/tmdb` or `…/api/tvdb`, with optional `Authorization: Bearer yyyy-MM-dd`).

Remote `config.json` now also publishes **`reverseProxies`**: general OpenResty proxies that forward by `X-Upstream-Base-Url` and authenticate with `X-Proxy-Authorization` (UTC `yyyyMMdd` date-token). See `reverse-proxy-readme.md`.

## Goal

Migrate Searchbox discovery/search from dedicated `mediaDatabases` direct URLs to a **local-first, then remote OpenResty** proxy list, sharing one preferred remote proxy (`preferReverseProxyBaseUrl`) for both TMDB and TVDB. Upstream remains the SMM-managed hosts (`tmdb-mcp-server.imlc.me/api/tmdb|tvdb`).

## Codebase Analysis

### Architecture

```
┌─────────────┐     GET /api/discover      ┌──────────────────┐
│  apps/ui    │ ─────────────────────────► │ apps/cli discover│
│  Searchbox  │ ◄─ mediaDatabases          │  + reverseProxies│
│  Discovery  │ ◄─ reverseProxies (new)    └──────────────────┘
└──────┬──────┘
       │ today: direct fetch to mediaDatabases URLs
       │ target: local SMM proxy first, then OpenResty reverseProxies
       ▼
┌──────────────────┐     ┌─────────────────────────────┐
│ Local reverse    │     │ Remote OpenResty proxy      │
│ X-SMM-Proxy-…    │     │ X-Upstream-Base-Url         │
│ (hello URL)      │     │ X-Proxy-Authorization       │
└──────────────────┘     └─────────────────────────────┘
```

### Code flow (current Searchbox)

```
main.tsx
  → startMediaDatabaseServiceDiscovery()
      → fetchDiscoveredMediaDatabases()  // mediaDatabases only
      → probeAndStore(tmdb) / probeAndStore(tvdb)
      → preferTmdbBaseUrl / preferTvdbBaseUrl

MediaDatabaseSearchbox
  → useMediaDatabaseBaseUrls("tmdb"|"tvdb")
  → searchTmdbDirect / searchTvdbDirect  // bypass local proxy
```

### Confirmed decisions

1. Try **local** `appConfig.reverseProxyUrl` first, then **remote** `reverseProxies`.
2. Upstream for both = SMM-managed (`SMM_TMDB_DEFAULT_UPSTREAM` / `SMM_TVDB_DEFAULT_UPSTREAM`).
3. Dual-protocol adapter (local `X-SMM-*` vs OpenResty `X-Upstream-*` / `X-Proxy-Authorization`).
4. Replace `preferTmdbBaseUrl` / `preferTvdbBaseUrl` with `preferReverseProxyBaseUrl`.

## References

- `reverse-proxy-readme.md` — OpenResty proxy protocol
- `docs/superpowers/design/media-database.md` — current discovery design
- `apps/cli/src/route/discover.ts` — already returns `reverseProxies`
- `apps/ui/src/api/discover.ts` — UI client already parses `reverseProxies`
