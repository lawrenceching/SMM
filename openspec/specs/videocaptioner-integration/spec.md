## Purpose

Define VideoCaptioner availability discovery, **Transcribe**, **Translate**, **Synthesize**, and **Process** UI gating, and the transcription API trigger.
## Requirements
### Requirement: VideoCaptioner availability discovery

The system SHALL perform VideoCaptioner availability checks using the executeCmd probe helper during application startup (and on demand), not via `GET /api/videocaptioner/discover`.

#### Scenario: Executable discovered successfully

- **WHEN** startup probe succeeds
- **THEN** the system exposes availability indicating transcription-related actions may be enabled

#### Scenario: Executable is not discovered

- **WHEN** startup probe fails
- **THEN** the system exposes availability indicating transcription is disabled

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

### Requirement: Process action gating in UI

The system SHALL enable or disable the **Process** action surfaces in panel headers and `MusicFileTable` context menu **Subtitle** entry points based on whether VideoCaptioner discovery reports **available** and whether the selected **ASR** / translator configuration can run **`videocaptioner process`** for at least one eligible target. Tencent ASR availability alone SHALL NOT imply **Process** is available, because **Process** includes subtitle optimization and translation steps that require VideoCaptioner.

#### Scenario: Process action enabled when VideoCaptioner is available and transcribe leg is satisfiable

- **WHEN** the UI has a discovery result where VideoCaptioner is available **and** the default or user-selected pipeline ASR options satisfy the same gating rules as **Transcribe** for the relevant targets
- **THEN** the **Process** action is enabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points subject to media-path eligibility rules

#### Scenario: Process action disabled when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** the **Process** action is disabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points regardless of Tencent ASR availability

#### Scenario: Process action disabled when ASR configuration cannot satisfy the pipeline

- **WHEN** VideoCaptioner is available but the user-selected or default **ASR** requires Tencent ASR or other configuration that is not enabled
- **THEN** the **Process** action is disabled or confirm is blocked with a localized reason until configuration supports the chosen ASR

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

When the user triggers VideoCaptioner transcribe (dialog or direct pipeline), the system SHALL invoke **`POST /api/executeCmd`** with the transcribe adapter args rather than `POST /api/videocaptioner/transcribe`.

#### Scenario: Transcribe from dialog

- **WHEN** the user confirms transcribe with VideoCaptioner provider and valid media path
- **THEN** the UI or Service Worker issues executeCmd with transcribe args including optional ASR and format flags

