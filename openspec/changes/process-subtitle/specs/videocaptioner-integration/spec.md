## ADDED Requirements

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
