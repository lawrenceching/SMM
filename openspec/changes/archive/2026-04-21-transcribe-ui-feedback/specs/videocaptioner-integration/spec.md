## MODIFIED Requirements

### Requirement: Transcription command trigger
The system SHALL provide an API operation that triggers VideoCaptioner transcription for a selected media file using fixed v1 defaults and waits for command completion before returning success/failure outcome.

#### Scenario: Transcription completes successfully
- **WHEN** a user triggers `Transcribe` for a supported media file and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating transcription completed

#### Scenario: Transcription completes with failure
- **WHEN** a user triggers `Transcribe` and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as transcription failure
