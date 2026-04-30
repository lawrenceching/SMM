## Purpose

Define how the UI accesses TVDB v4 through the CLI-managed reverse proxy, including upstream selection from `UserConfig.tvdb.host`, in-process token caching from a UI-driven `POST /login`, and avoiding any disk-persisted token cache on the CLI side.

## Requirements

### Requirement: UI sends every TVDB request through the discovered reverse proxy

The UI SHALL send every TVDB v4 API request to the reverse proxy URL discovered from the `hello` task and SHALL NOT call any CLI `/tvdb/*` route or the TVDB upstream directly from the browser.

#### Scenario: TVDB request is sent to the reverse proxy

- **WHEN** the UI fetches a TVDB v4 endpoint (e.g., `/series/{id}/extended`, `/seasons/{id}/extended`, `/search`)
- **AND** the hello response includes a reverse proxy base URL `http://127.0.0.1:<port>`
- **THEN** the request is sent to `http://127.0.0.1:<port>/<tvdb-path>?<query>` with `X-SMM-Proxy-Upstream-BaseURL` set to the selected TVDB upstream base URL

#### Scenario: Reverse proxy URL is unavailable

- **WHEN** the UI attempts a TVDB request and no reverse proxy URL is available
- **THEN** the UI reports an error to the caller without falling back to a CLI `/tvdb/*` route

### Requirement: UI selects TVDB upstream base URL from user configuration

The UI SHALL set the `X-SMM-Proxy-Upstream-BaseURL` header on TVDB requests using the user-configured TVDB host when present, and SHALL use the SMM-managed default TVDB upstream base URL when the configured host is empty.

#### Scenario: User-configured TVDB host is used

- **WHEN** `UserConfig.tvdb.host` is a non-empty value (e.g., `https://api4.thetvdb.com/v4`)
- **THEN** the UI sends `X-SMM-Proxy-Upstream-BaseURL: <normalized configured host>` on every TVDB proxy request, including the login request

#### Scenario: SMM-managed default upstream is used

- **WHEN** `UserConfig.tvdb.host` is unset or empty
- **THEN** the UI sends `X-SMM-Proxy-Upstream-BaseURL: <SMM-managed TVDB upstream base URL>` on TVDB proxy requests

### Requirement: UI performs TVDB login through the reverse proxy when an API key is configured

The UI SHALL perform a TVDB v4 `POST /login` (with `{ "apikey": "<apiKey>" }` body) through the reverse proxy when `UserConfig.tvdb.apiKey` is non-empty and the selected upstream requires authentication. The UI SHALL cache the resulting token in process memory for the duration of its validity and SHALL NOT write the token to disk.

#### Scenario: First TVDB call performs login

- **WHEN** `UserConfig.tvdb.apiKey` is non-empty
- **AND** the configured TVDB upstream requires authentication (e.g., `api4.thetvdb.com/v4`)
- **AND** no valid cached token exists in the UI process
- **THEN** the UI sends `POST <reverseProxyUrl>/login` with body `{ "apikey": "<apiKey>" }` and `X-SMM-Proxy-Upstream-BaseURL` set to the TVDB upstream
- **AND** the UI stores the returned token in process memory

#### Scenario: Subsequent TVDB call reuses cached token

- **WHEN** the UI has a valid cached TVDB token
- **THEN** the UI does not perform another login and reuses the in-memory token

#### Scenario: Concurrent TVDB calls share a single login

- **WHEN** multiple TVDB calls are issued before the first login response returns
- **THEN** the UI deduplicates the in-flight login so only one `POST /login` is sent to the upstream

### Requirement: UI attaches Authorization header for cached TVDB token

The UI SHALL attach `Authorization: Bearer <token>` to TVDB requests when a cached token exists for the selected upstream, and SHALL NOT attach `Authorization` when targeting an SMM-managed upstream that does not require authentication.

#### Scenario: Authenticated TVDB call

- **WHEN** the UI has a cached TVDB token for the selected upstream
- **THEN** the TVDB proxy request includes `Authorization: Bearer <token>`

#### Scenario: SMM-managed proxy upstream skips Authorization

- **WHEN** the selected TVDB upstream is the SMM-managed default that does not require authentication
- **AND** no TVDB API key is configured
- **THEN** the UI does not perform login and does not attach an `Authorization` header

### Requirement: TVDB token is not persisted to disk by the CLI

The application SHALL NOT write a TVDB token cache file (such as `tvdb-token.txt`) under the application data directory.

#### Scenario: No CLI-side TVDB token cache file

- **WHEN** the user issues TVDB requests through the UI
- **THEN** the CLI does not create or update any TVDB token cache file in the user data directory or app data directory
