## MODIFIED Requirements

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
