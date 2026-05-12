## Purpose

Define VideoCaptioner availability discovery, **Transcribe**, **Translate**, and **Synthesize** UI gating, and the transcription API trigger.

## Requirements

### Requirement: VideoCaptioner availability discovery
The system SHALL perform VideoCaptioner executable presence discovery during application startup and expose an availability result to the UI.

#### Scenario: Executable discovered successfully
- **WHEN** the application startup sequence performs VideoCaptioner discovery and an executable is resolvable
- **THEN** the system returns an availability result indicating transcription is enabled

#### Scenario: Executable is not discovered
- **WHEN** the application startup sequence performs VideoCaptioner discovery and no executable is resolvable
- **THEN** the system returns an availability result indicating transcription is disabled

### Requirement: Translate action gating in UI

The system SHALL enable or disable the **Translate** action surfaces in panel headers and `MusicFileTable` context menu based on whether VideoCaptioner discovery reports **available**. Tencent ASR availability SHALL NOT enable **Translate**, as Tencent ASR is not a translation backend.

#### Scenario: Translate action enabled when VideoCaptioner is available

- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the **Translate** action is enabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` `Subtitle` entry points (subject to source-subtitle eligibility rules)

#### Scenario: Translate action disabled when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** the **Translate** action is disabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` `Subtitle` entry points regardless of Tencent ASR availability

### Requirement: Synthesize action gating in UI

The system SHALL enable or disable the **Synthesize** action surfaces in panel headers and `MusicFileTable` context menu **Subtitle** entry points based on whether VideoCaptioner discovery reports **available**. Tencent ASR availability SHALL NOT enable **Synthesize**, as Tencent ASR is not a subtitle-to-video synthesis backend.

#### Scenario: Synthesize action enabled when VideoCaptioner is available

- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the **Synthesize** action is enabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points subject to **(video, subtitle)** eligibility rules

#### Scenario: Synthesize action disabled when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** the **Synthesize** action is disabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points regardless of Tencent ASR availability

### Requirement: Transcribe action gating in UI

The system SHALL enable or disable the `Transcribe` action exposed through the panel **Subtitle** entry points (header `Subtitle > Transcribe` and row-context-menu `Subtitle > Transcribe` in `MusicFileTable`) based on whether transcription can proceed: when VideoCaptioner discovery reports **available**, **OR** when Tencent ASR transcription is **enabled** for the application (for example via feature configuration).

#### Scenario: Action enabled when VideoCaptioner is available

- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the `Transcribe` action is enabled under the `Subtitle` entry in `MusicPanel` (header and row context menu) and in `TvShowPanel` / `MoviePanel` headers for supported media-file context menus (subject to existing path eligibility rules)

#### Scenario: Action enabled when Tencent ASR is enabled without VideoCaptioner

- **WHEN** VideoCaptioner discovery reports unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the `Transcribe` action is enabled under the `Subtitle` entry in `MusicPanel` (header and row context menu) and in `TvShowPanel` / `MoviePanel` headers for supported media-file context menus (subject to existing path eligibility rules)

#### Scenario: Action disabled when neither path is available

- **WHEN** VideoCaptioner discovery reports unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the `Transcribe` action is disabled under the `Subtitle` entry in `MusicPanel` (header and row context menu) and in `TvShowPanel` / `MoviePanel` headers for supported media-file context menus

### Requirement: Transcription command trigger

The system SHALL provide an API operation that triggers VideoCaptioner transcription for a selected media file and waits for command completion before returning success/failure outcome. The request SHALL include **`mediaPath`**. The request MAY include **`asr`** with one of **`bijian`**, **`jianying`**, or **`whisper-cpp`**; when **`asr`** is omitted, the system SHALL use **`bijian`**. The request MAY include **`language`** as a non-empty string (`auto` or an ISO 639-1 language code); when omitted, the system SHALL use the same default as **`videocaptioner transcribe`** for language (`auto`). The request MAY include **`wordTimestamps`** as a boolean; when true, the CLI SHALL be invoked with **`--word-timestamps`**; when false or omitted, the CLI SHALL NOT pass **`--word-timestamps`**. The request MAY include **`format`** as one of **`srt`**, **`ass`**, **`txt`**, **`json`**; when omitted, the system SHALL default to **`srt`**. The CLI invocation SHALL pass **`--asr`**, resolved **`--language`** (when specified by implementation rules above), optional **`--word-timestamps`**, and **`--format`** to **`videocaptioner transcribe`**.

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

#### Scenario: Optional VideoCaptioner flags forwarded

- **WHEN** the transcription API is called with valid **`language`**, **`wordTimestamps`**, and **`format`** fields
- **THEN** the system SHALL invoke **`videocaptioner transcribe`** with CLI arguments consistent with those fields

#### Scenario: Invalid format rejected

- **WHEN** the transcription API is called with **`format`** outside **`srt`**, **`ass`**, **`txt`**, **`json`**
- **THEN** the API returns a client error response indicating invalid input
