## Purpose

Define the CLI-managed standalone reverse proxy that runs on a random localhost port and forwards browser requests to allowlisted external metadata APIs (TMDB, TVDB) with header-based upstream selection, hop-by-hop header filtering, and CORS support.

## Requirements

### Requirement: CLI starts a standalone external API reverse proxy

The CLI SHALL start a localhost-only reverse proxy server on an available random port in the inclusive range `30000` through `31000`.

#### Scenario: Proxy starts on a valid random port

- **WHEN** the CLI application starts successfully
- **THEN** the reverse proxy listens on `127.0.0.1` using a port from `30000` through `31000`

#### Scenario: Proxy address is available to the CLI

- **WHEN** the reverse proxy has started
- **THEN** the CLI can provide its base URL in the form `http://127.0.0.1:<port>`

### Requirement: Reverse proxy forwards requests to header-selected upstreams

The reverse proxy SHALL forward requests to the upstream base URL specified by the `X-SMM-Proxy-Upstream-BaseURL` request header, preserving request method, path, query string, and request body.

#### Scenario: Request is forwarded to upstream base URL with path prefix

- **WHEN** a client sends `GET /tv/123?language=en-US` with `X-SMM-Proxy-Upstream-BaseURL: https://api.themoviedb.org/3`
- **THEN** the proxy forwards `GET https://api.themoviedb.org/3/tv/123?language=en-US` to the upstream

#### Scenario: Request body is forwarded for body-capable methods

- **WHEN** a client sends a `POST` request with a body and an allowlisted upstream base URL
- **THEN** the proxy forwards the same request body to the upstream request

#### Scenario: Missing upstream header is rejected

- **WHEN** a client sends a proxy request without `X-SMM-Proxy-Upstream-BaseURL`
- **THEN** the proxy rejects the request with a client error response

### Requirement: Reverse proxy enforces upstream allowlist

The reverse proxy SHALL only allow upstream hostnames `api.themoviedb.org`, `api4.thetvdb.com`, `tmdb-mcp-server.imlc.me`, and `httpbin.io`.

#### Scenario: Allowlisted upstream host is accepted

- **WHEN** a client sends a proxy request with `X-SMM-Proxy-Upstream-BaseURL: https://api.themoviedb.org/3`
- **THEN** the proxy forwards the request to the TMDB upstream

#### Scenario: SMM-managed upstream host is accepted

- **WHEN** a client sends a proxy request with `X-SMM-Proxy-Upstream-BaseURL: https://tmdb-mcp-server.imlc.me/api/tmdb` or `https://tmdb-mcp-server.imlc.me/api/tvdb`
- **THEN** the proxy forwards the request to the SMM-managed upstream

#### Scenario: Non-allowlisted upstream host is rejected

- **WHEN** a client sends a proxy request with `X-SMM-Proxy-Upstream-BaseURL: https://example.com/api`
- **THEN** the proxy rejects the request without contacting `example.com`

### Requirement: Reverse proxy filters hop-by-hop headers

The reverse proxy SHALL remove hop-by-hop headers from forwarded upstream requests and downstream responses, and SHALL set the upstream request `Host` header to the selected upstream host.

#### Scenario: Hop-by-hop request headers are not forwarded

- **WHEN** a client sends a proxy request containing `Connection` or `Upgrade` headers
- **THEN** the upstream request does not include those hop-by-hop headers

#### Scenario: Upstream Host header is rewritten

- **WHEN** a client sends a proxy request to localhost with `X-SMM-Proxy-Upstream-BaseURL: https://httpbin.io`
- **THEN** the upstream receives `Host: httpbin.io`

### Requirement: Hello task exposes reverse proxy address

The hello task SHALL include the active reverse proxy base URL so UI clients can discover the local proxy at runtime.

#### Scenario: Hello response includes proxy URL

- **WHEN** the UI executes the `hello` task after the reverse proxy has started
- **THEN** the response includes the reverse proxy base URL in the form `http://127.0.0.1:<port>`
