## MODIFIED Requirements

### Requirement: Status bar surfaces TMDB and TVDB availability issues
The system SHALL present TMDB/TVDB/VideoCaptioner availability issues as `MessageIndicator` messages in the status bar with severity-based message typing.

#### Scenario: TMDB unavailable is surfaced as an error message
- **WHEN** TMDB service is unavailable in UI-visible discovery/connection status
- **THEN** the status bar `MessageIndicator` includes a TMDB message with `type` set to `error`

#### Scenario: TVDB unavailable is surfaced as an error message
- **WHEN** TVDB service is unavailable in UI-visible discovery/connection status
- **THEN** the status bar `MessageIndicator` includes a TVDB message with `type` set to `error`

#### Scenario: VideoCaptioner unavailable is surfaced as an error message
- **WHEN** VideoCaptioner discovery reports unavailable in UI-visible discovery status
- **THEN** the status bar `MessageIndicator` includes a VideoCaptioner message with `type` set to `error`
