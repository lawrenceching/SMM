## ADDED Requirements

### Requirement: UI sends every TMDB request through the discovered reverse proxy

The UI SHALL send every TMDB API request to the reverse proxy URL discovered from the `hello` task and SHALL NOT call any CLI `/tmdb/*` route or the TMDB upstream directly from the browser.

#### Scenario: TMDB request is sent to the reverse proxy

- **WHEN** the UI fetches a TMDB endpoint (e.g., `/tv/{id}`, `/movie/{id}`, `/search/tv`, `/tv/{id}/season/{n}`)
- **AND** the hello response includes a reverse proxy base URL `http://127.0.0.1:<port>`
- **THEN** the request is sent to `http://127.0.0.1:<port>/<tmdb-path>?<query>` rather than to the TMDB upstream or any CLI `/tmdb/*` route

#### Scenario: Reverse proxy URL is unavailable

- **WHEN** the UI attempts a TMDB request and no reverse proxy URL is available from the hello response
- **THEN** the UI reports an error to the caller without falling back to a CLI `/tmdb/*` route or to the TMDB upstream

### Requirement: UI selects TMDB upstream base URL from user configuration

The UI SHALL set the `X-SMM-Proxy-Upstream-BaseURL` header on TMDB requests using the user-configured TMDB host when present, and SHALL use the SMM-managed default upstream base URL when the configured host is empty.

#### Scenario: User-configured TMDB host is used

- **WHEN** `UserConfig.tmdb.host` is a non-empty value (e.g., `https://api.themoviedb.org/3` or a self-hosted mirror)
- **THEN** the UI sends `X-SMM-Proxy-Upstream-BaseURL: <normalized configured host>` on the TMDB proxy request

#### Scenario: SMM-managed default upstream is used

- **WHEN** `UserConfig.tmdb.host` is unset or an empty string
- **THEN** the UI sends `X-SMM-Proxy-Upstream-BaseURL: <SMM-managed TMDB upstream base URL>` on the TMDB proxy request

### Requirement: UI attaches Authorization header for configured TMDB API key

The UI SHALL attach `Authorization: Bearer <apiKey>` to TMDB requests when `UserConfig.tmdb.apiKey` is non-empty, and SHALL NOT attach `Authorization` otherwise.

#### Scenario: API key is configured

- **WHEN** `UserConfig.tmdb.apiKey` is non-empty
- **THEN** the TMDB proxy request includes `Authorization: Bearer <apiKey>` (the UI does not rely on the CLI to inject this header)

#### Scenario: API key is not configured

- **WHEN** `UserConfig.tmdb.apiKey` is unset or empty
- **THEN** the TMDB proxy request does not include an `Authorization` header

### Requirement: TMDB request preserves method, path, query, and body through the proxy

The UI SHALL build the TMDB proxy request URL by appending the TMDB path and query string to the reverse proxy base URL, preserving HTTP method and body, and SHALL NOT add the `/tmdb` URL prefix used by the legacy CLI route.

#### Scenario: GET TMDB endpoint with query string

- **WHEN** the UI calls `searchTmdb(query, "tv", "en-US")`
- **AND** the reverse proxy URL is `http://127.0.0.1:30005`
- **THEN** the resulting request is `GET http://127.0.0.1:30005/search/tv?query=<encoded>&language=en-US` with `X-SMM-Proxy-Upstream-BaseURL` and (if applicable) `Authorization` headers, and without an `/tmdb` prefix

#### Scenario: TMDB image URLs are not proxied

- **WHEN** the UI builds a TMDB image URL via `getTMDBImageUrl(...)`
- **THEN** the URL points at the TMDB image CDN (e.g., `https://image.tmdb.org/t/p/...`) and is not routed through the reverse proxy
