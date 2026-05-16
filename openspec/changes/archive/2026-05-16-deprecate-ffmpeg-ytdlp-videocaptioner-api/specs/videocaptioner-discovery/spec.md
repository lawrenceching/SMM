## MODIFIED Requirements

### Requirement: Settings UI displays discovered VideoCaptioner path

The system SHALL display VideoCaptioner availability in `GeneralSettings` based on the executeCmd availability probe (or user-configured path when set), not on `GET /api/videocaptioner/discover`.

#### Scenario: Path is available

- **WHEN** the probe reports a resolvable VideoCaptioner executable or user config provides a valid path
- **THEN** `GeneralSettings` shows the resolved executable path value

#### Scenario: Path is unavailable

- **WHEN** the probe reports unavailable and no valid configured path exists
- **THEN** `GeneralSettings` shows the unavailable state with guidance consistent with existing UX

## REMOVED Requirements

### Requirement: Python Scripts folder discovery for VideoCaptioner

**Reason**: HTTP discovery routes removed; server-side discovery remains internal to `executeCmd` path resolution only.

**Migration**: UI uses executeCmd probe helper; bundled/configured path rules unchanged on CLI.

### Requirement: Existing discovery sources remain supported

**Reason**: Superseded by internal CLI resolution + client probe; no public discover HTTP API.

**Migration**: None for end users; developers use probe helper.
