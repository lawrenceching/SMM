## MODIFIED Requirements

### Requirement: TMDB endpoint mode is selected from TMDB host configuration
The system SHALL select the TMDB upstream base URL from user configuration and the discovered reverse proxy URL from the hello task so that all TMDB requests are sent through the reverse proxy with the upstream selected by `UserConfig.tmdb.host`. The reverse proxy URL is the only TMDB transport; there is no separate "direct mode" or "CLI `/tmdb` route" path.

#### Scenario: SMM-managed upstream when TMDB host is empty
- **WHEN** TMDB host is unset or an empty string in user configuration
- **AND** the hello response includes a reverse proxy base URL
- **THEN** UI TMDB requests are sent to the discovered reverse proxy base URL with `X-SMM-Proxy-Upstream-BaseURL` set to the SMM-managed default TMDB upstream base URL

#### Scenario: Configured upstream when TMDB host is provided
- **WHEN** TMDB host is configured with a non-empty value in user configuration
- **AND** the hello response includes a reverse proxy base URL
- **THEN** UI TMDB requests are sent to the discovered reverse proxy base URL with `X-SMM-Proxy-Upstream-BaseURL` set to the configured TMDB host
- **AND** `Authorization: Bearer <UserConfig.tmdb.apiKey>` is attached when the API key is non-empty

### Requirement: Media import initialization uses unified TMDB endpoint routing
The system SHALL apply the same TMDB endpoint mode selection to TMDB requests triggered by media folder import and media library import initialization workflows, so all such requests go through the discovered reverse proxy with the same upstream and Authorization derivation.

#### Scenario: Imported media folder initialization uses SMM-managed upstream
- **WHEN** a media folder import initialization triggers TMDB lookups and TMDB host is empty
- **AND** the hello response includes a reverse proxy base URL
- **THEN** all TMDB lookups in that initialization flow are sent through the reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` set to the SMM-managed default TMDB upstream

#### Scenario: Imported media library initialization uses configured upstream
- **WHEN** a media library import initialization triggers TMDB lookups and TMDB host is configured
- **AND** the hello response includes a reverse proxy base URL
- **THEN** all TMDB lookups in that initialization flow are sent through the reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` set to the configured TMDB host (and `Authorization: Bearer <apiKey>` when an API key is configured)

### Requirement: TMDB search uses unified TMDB endpoint routing
The system SHALL apply the same TMDB endpoint mode selection to TMDB search requests initiated from the media database search UI, sending them through the discovered reverse proxy with the configured upstream and Authorization derivation.

#### Scenario: Search request uses SMM-managed upstream
- **WHEN** the user runs TMDB search while TMDB host is empty
- **AND** the hello response includes a reverse proxy base URL
- **THEN** the search request is sent through the discovered reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` set to the SMM-managed default TMDB upstream

#### Scenario: Search request uses configured upstream
- **WHEN** the user runs TMDB search while TMDB host is configured
- **AND** the hello response includes a reverse proxy base URL
- **THEN** the search request is sent through the discovered reverse proxy with `X-SMM-Proxy-Upstream-BaseURL` set to the configured TMDB host (and `Authorization: Bearer <apiKey>` when an API key is configured)
