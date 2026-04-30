## REMOVED Requirements

### Requirement: TMDB API Proxy accepts and routes requests

**Reason**: The CLI `/tmdb/*` route is removed. All TMDB requests are now sent by the UI through the generic reverse proxy (`X-SMM-Proxy-Upstream-BaseURL`); upstream selection happens in the UI based on `UserConfig.tmdb.host`.

**Migration**: UI clients construct TMDB requests as `<reverseProxyUrl>/<tmdb-path>?<query>` with `X-SMM-Proxy-Upstream-BaseURL` set to either the user-configured TMDB host or the SMM-managed default upstream. See the `tmdb-ui-reverse-proxy-access` capability and the `external-api-reverse-proxy` allowlist.

### Requirement: TMDB API Proxy forwards X-TMDB-API-Key as Authorization

**Reason**: With the CLI `/tmdb/*` route removed, the UI attaches `Authorization: Bearer <apiKey>` directly to its proxy request. The `X-TMDB-API-Key` indirection is no longer needed.

**Migration**: UI code that previously sent `X-TMDB-API-Key` now reads `UserConfig.tmdb.apiKey` and sets `Authorization: Bearer <apiKey>` itself before sending the request through the reverse proxy. See the `tmdb-ui-reverse-proxy-access` capability.

### Requirement: TMDB API Proxy preserves request method, path, query, and body

**Reason**: The CLI `/tmdb/*` route is removed; method/path/query/body preservation is now provided by the generic reverse proxy as defined in the `external-api-reverse-proxy` capability.

**Migration**: Rely on the existing `external-api-reverse-proxy` requirement "Reverse proxy forwards requests to header-selected upstreams" for method/path/query/body preservation. UI code constructs the proxy request URL directly without an `/tmdb` prefix.
