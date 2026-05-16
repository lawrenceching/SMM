## MODIFIED Requirements

### Requirement: VideoCaptioner availability discovery

The system SHALL perform VideoCaptioner availability checks using the executeCmd probe helper during application startup (and on demand), not via `GET /api/videocaptioner/discover`.

#### Scenario: Executable discovered successfully

- **WHEN** startup probe succeeds
- **THEN** the system exposes availability indicating transcription-related actions may be enabled

#### Scenario: Executable is not discovered

- **WHEN** startup probe fails
- **THEN** the system exposes availability indicating transcription is disabled

### Requirement: Transcription command trigger

When the user triggers VideoCaptioner transcribe (dialog or direct pipeline), the system SHALL invoke **`POST /api/executeCmd`** with the transcribe adapter args rather than `POST /api/videocaptioner/transcribe`.

#### Scenario: Transcribe from dialog

- **WHEN** the user confirms transcribe with VideoCaptioner provider and valid media path
- **THEN** the UI or Service Worker issues executeCmd with transcribe args including optional ASR and format flags
