## Purpose
Define how the application discovers VideoCaptioner executables and presents discovery results in the UI.
## Requirements
### Requirement: Settings UI displays discovered VideoCaptioner path

The system SHALL display VideoCaptioner availability in `GeneralSettings` based on the executeCmd availability probe (or user-configured path when set), not on `GET /api/videocaptioner/discover`.

#### Scenario: Path is available

- **WHEN** the probe reports a resolvable VideoCaptioner executable or user config provides a valid path
- **THEN** `GeneralSettings` shows the resolved executable path value

#### Scenario: Path is unavailable

- **WHEN** the probe reports unavailable and no valid configured path exists
- **THEN** `GeneralSettings` shows the unavailable state with guidance consistent with existing UX

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

