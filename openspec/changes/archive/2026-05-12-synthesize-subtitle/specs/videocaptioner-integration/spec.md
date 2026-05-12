## ADDED Requirements

### Requirement: Synthesize action gating in UI

The system SHALL enable or disable the **Synthesize** action surfaces in panel headers and `MusicFileTable` context menu **Subtitle** entry points based on whether VideoCaptioner discovery reports **available**. Tencent ASR availability SHALL NOT enable **Synthesize**, as Tencent ASR is not a subtitle-to-video synthesis backend.

#### Scenario: Synthesize action enabled when VideoCaptioner is available

- **WHEN** the UI has a discovery result where VideoCaptioner is available
- **THEN** the **Synthesize** action is enabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points subject to **(video, subtitle)** eligibility rules

#### Scenario: Synthesize action disabled when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery reports unavailable
- **THEN** the **Synthesize** action is disabled in `TvShowPanel` / `MoviePanel` / `MusicPanel` **Subtitle** entry points regardless of Tencent ASR availability
