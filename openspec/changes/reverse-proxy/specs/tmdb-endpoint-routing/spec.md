## MODIFIED Requirements

### Requirement: TMDB endpoint mode is selected from TMDB host configuration

The system SHALL select TMDB request mode from user configuration and hello-discovered reverse proxy information so that local reverse proxy mode is used when TMDB host is empty and direct mode is used when TMDB host is provided.

#### Scenario: Proxy mode when TMDB host is empty

- **WHEN** TMDB host is unset or an empty string in user configuration
- **AND** the hello response includes a reverse proxy base URL
- **THEN** UI TMDB requests are sent to the discovered reverse proxy base URL with `X-SMM-Proxy-Upstream-BaseURL` set to the configured TMDB upstream base URL

#### Scenario: Direct mode when TMDB host is configured

- **WHEN** TMDB host is configured with a non-empty value in user configuration
- **THEN** UI TMDB requests are sent directly according to the configured TMDB host endpoint behavior

### Requirement: Media import initialization uses unified TMDB endpoint routing

The system SHALL apply the same TMDB endpoint mode selection to TMDB requests triggered by media folder import and media library import initialization workflows.

#### Scenario: Imported media folder initialization uses proxy mode

- **WHEN** a media folder import initialization triggers TMDB lookups and TMDB host is empty
- **AND** the hello response includes a reverse proxy base URL
- **THEN** all TMDB lookups in that initialization flow use the discovered reverse proxy endpoint

#### Scenario: Imported media library initialization uses direct mode

- **WHEN** a media library import initialization triggers TMDB lookups and TMDB host is configured
- **THEN** all TMDB lookups in that initialization flow use the configured TMDB host endpoint

### Requirement: TMDB search uses unified TMDB endpoint routing

The system SHALL apply the same TMDB endpoint mode selection to TMDB search requests initiated from the media database search UI.

#### Scenario: Search request uses proxy mode

- **WHEN** the user runs TMDB search while TMDB host is empty
- **AND** the hello response includes a reverse proxy base URL
- **THEN** search requests are sent through the discovered reverse proxy endpoint

#### Scenario: Search request uses direct mode

- **WHEN** the user runs TMDB search while TMDB host is configured
- **THEN** search requests are sent directly to the configured TMDB host endpoint
