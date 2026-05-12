## ADDED Requirements

### Requirement: Translate action gating in UI

The system SHALL enable or disable the **Translate** action surfaces in panel headers and `MusicFileTable` context menu based on whether VideoCaptioner discovery reports **available**. Tencent ASR availability SHALL NOT enable **Translate**, as Tencent ASR is not a translation backend.

#### Scenario: Translate action enabled when VideoCaptioner is available

- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the **Translate** action is enabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` `Subtitle` entry points (subject to source-subtitle eligibility rules)

#### Scenario: Translate action disabled when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** the **Translate** action is disabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` `Subtitle` entry points regardless of Tencent ASR availability

## MODIFIED Requirements

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
