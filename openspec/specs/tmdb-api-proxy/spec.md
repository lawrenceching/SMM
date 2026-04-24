## Purpose

Define the TMDB API proxy behavior in `apps/cli`, which accepts browser requests and routes them to either the official TMDB API or the SMM proxy based on request headers.

## Requirements

### Requirement: TMDB API Proxy accepts and routes requests

The proxy service SHALL accept HTTP requests and forward them to the appropriate upstream TMDB API server based on the `X-TMDB-Host` header, transparently returning the upstream response to the client.

#### Scenario: Request routed to official TMDB API when X-TMDB-Host is set

- **WHEN** the client sends a request with `X-TMDB-Host: api.themoviedb.org` header
- **THEN** the proxy forwards the request to `https://api.themoviedb.org/3`, preserving the path and query parameters, without adding `/api/tmdb` prefix

#### Scenario: Request routed to SMM proxy when X-TMDB-Host is not set

- **WHEN** the client sends a request without the `X-TMDB-Host` header
- **THEN** the proxy forwards the request to `https://tmdb-mcp-server.imlc.me`, adding `/api/tmdb` prefix to the path

### Requirement: TMDB API Proxy forwards X-TMDB-API-Key as Authorization

The proxy service SHALL read the `X-TMDB-API-Key` header and forward it as `Authorization: Bearer <value>` header to the upstream TMDB API.

#### Scenario: X-TMDB-API-Key is provided

- **WHEN** the client request includes `X-TMDB-API-Key: abc123` header
- **THEN** the proxy adds `Authorization: Bearer abc123` header to the upstream request

#### Scenario: X-TMDB-API-Key is not provided

- **WHEN** the client request does not include `X-TMDB-API-Key` header
- **THEN** the proxy does not add an `Authorization` header to the upstream request

### Requirement: TMDB API Proxy preserves request method, path, query, and body

The proxy service SHALL preserve the client request's HTTP method, path, query parameters, and body, only modifying the target host and path prefix according to routing rules.

#### Scenario: GET request with query parameters is proxied

- **WHEN** the client sends a `GET /3/tv/123?language=en-US` request
- **AND** `X-TMDB-Host: api.themoviedb.org`
- **THEN** the proxy sends `GET https://api.themoviedb.org/3/tv/123?language=en-US` to the upstream

#### Scenario: POST request with body is proxied

- **WHEN** the client sends a `POST /3/search/tv` request with JSON body
- **AND** `X-TMDB-Host` is not set
- **THEN** the proxy sends `POST https://tmdb-mcp-server.imlc.me/api/tmdb/3/search/tv` with the same body to the upstream
