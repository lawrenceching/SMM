## MODIFIED Requirements

### Requirement: Transcription command trigger

The system SHALL provide an API operation that triggers VideoCaptioner transcription for a selected media file and waits for command completion before returning success/failure outcome. The request SHALL include **`mediaPath`**. The request MAY include **`asr`** with one of **`bijian`**, **`jianying`**, or **`whisper-cpp`**; when **`asr`** is omitted, the system SHALL use **`bijian`**. The CLI invocation SHALL pass **`--asr`** with that resolved value to **`videocaptioner transcribe`**.

#### Scenario: Transcription completes successfully

- **WHEN** a user triggers `Transcribe` for a supported media file and VideoCaptioner exits successfully
- **THEN** the API returns a success response indicating transcription completed

#### Scenario: Transcription completes with failure

- **WHEN** a user triggers `Transcribe` and VideoCaptioner exits with a failure status or runtime execution error
- **THEN** the API returns an error response that can be surfaced to the user as transcription failure

#### Scenario: Request omits ASR

- **WHEN** the transcription API is called without an **`asr`** field
- **THEN** the system SHALL invoke VideoCaptioner with **`--asr bijian`**

#### Scenario: Request includes valid ASR

- **WHEN** the transcription API is called with **`asr`** equal to **`bijian`**, **`jianying`**, or **`whisper-cpp`**
- **THEN** the system SHALL invoke VideoCaptioner with **`--asr`** set to that value

#### Scenario: Invalid ASR rejected

- **WHEN** the transcription API is called with **`asr`** outside the allowed set
- **THEN** the API returns a client error response indicating invalid input
