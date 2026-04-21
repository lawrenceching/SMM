## ADDED Requirements

### Requirement: VideoCaptioner availability discovery
The system SHALL perform VideoCaptioner executable presence discovery during application startup and expose an availability result to the UI.

#### Scenario: Executable discovered successfully
- **WHEN** the application startup sequence performs VideoCaptioner discovery and an executable is resolvable
- **THEN** the system returns an availability result indicating transcription is enabled

#### Scenario: Executable is not discovered
- **WHEN** the application startup sequence performs VideoCaptioner discovery and no executable is resolvable
- **THEN** the system returns an availability result indicating transcription is disabled

### Requirement: Transcribe action gating in UI
The system SHALL enable or disable the `Transcribe` context-menu action in `MusicPanel` based on the latest discovery availability result.

#### Scenario: Action enabled when available
- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the `Transcribe` action is enabled in `MusicPanel` for supported media-file context menus

#### Scenario: Action disabled when unavailable
- **WHEN** the UI has a discovery result where VideoCaptioner is unavailable
- **THEN** the `Transcribe` action is disabled in `MusicPanel` for supported media-file context menus

### Requirement: Transcription command trigger
The system SHALL provide an API operation that triggers VideoCaptioner transcription for a selected media file using fixed v1 defaults and waits for command completion before returning success/failure outcome.

#### Scenario: Transcription completes successfully
- **WHEN** a user triggers `Transcribe` for a supported media file and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating transcription completed

#### Scenario: Transcription completes with failure
- **WHEN** a user triggers `Transcribe` and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as transcription failure
