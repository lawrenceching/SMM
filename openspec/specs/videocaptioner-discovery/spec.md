## ADDED Requirements

### Requirement: Python Scripts folder discovery for VideoCaptioner
The system SHALL include Python `Scripts` installation path candidates when discovering VideoCaptioner executables, including pip-installed layout patterns on supported operating systems.

#### Scenario: Windows pip-installed executable is discovered
- **WHEN** VideoCaptioner is installed at a Python `Scripts` path such as `.../Python310/Scripts/videocaptioner.exe`
- **THEN** discovery returns that executable path as available

#### Scenario: Python Scripts candidates are not present
- **WHEN** no VideoCaptioner executable exists in configured, bundled, install, or Python `Scripts` candidate paths
- **THEN** discovery returns an unavailable result with an error message

### Requirement: Existing discovery sources remain supported
The system SHALL preserve existing VideoCaptioner discovery sources while adding Python `Scripts` candidate checks.

#### Scenario: Existing configured path still takes precedence
- **WHEN** user-configured executable path exists and is valid
- **THEN** discovery returns the configured executable path without requiring Python `Scripts` lookup success

### Requirement: Settings UI displays discovered VideoCaptioner path
The system SHALL display the discovered VideoCaptioner path as a settings item in `GeneralSettings`.

#### Scenario: Path is available
- **WHEN** discovery returns a valid VideoCaptioner path
- **THEN** `GeneralSettings` shows the resolved executable path value

#### Scenario: Path is unavailable
- **WHEN** discovery returns an unavailable result
- **THEN** `GeneralSettings` shows an explicit unavailable state for VideoCaptioner path
