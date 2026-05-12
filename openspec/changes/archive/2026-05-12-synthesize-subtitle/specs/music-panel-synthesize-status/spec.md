## ADDED Requirements

### Requirement: MusicFileTable exposes synthesize row status

The system SHALL extend **`MusicFileRow`** with **`synthesizeStatus?: 'running' | 'failed'`** and extend **`MusicFileTableProps`** with optional handlers **`onTrackSynthesize?(row)`**, **`onSynthesizeStop?(row)`**, and **`isSynthesizeAvailable?`**, mirroring translate/transcribe patterns.

#### Scenario: Title cell shows synthesize progress or failure

- **WHEN** a row has an in-flight **`synthesize`** job (`running`) or a terminal failure visible to the row mapping
- **THEN** the title cell shows a distinct indicator (spinner for `running`, error styling for `failed`) with localized tooltips
- **AND** indicators can coexist with transcribe and translate indicators when multiple job types apply

### Requirement: MusicFileTable row Subtitle submenu includes Stop synthesize

The system SHALL show **Stop synthesize** inside the row **Subtitle** submenu when **`synthesizeStatus === 'running'`** for that row, and activating it SHALL stop the running job for that row via the same stop plumbing used for translate.

#### Scenario: Stop synthesize only when running

- **WHEN** `synthesizeStatus` is not `running`
- **THEN** **Stop synthesize** is not shown in the submenu

### Requirement: Submenu gating for Synthesize on music rows

The system SHALL disable the **Synthesize** item in the row **Subtitle** submenu when VideoCaptioner is unavailable, when the track has no resolvable **video** path suitable for synthesis, when no resolvable sibling subtitle exists, or when synthesis is otherwise ineligible per **`synthesize-subtitle-dialog`** rules.

#### Scenario: Synthesize disabled for ineligible track

- **WHEN** the row **Subtitle** submenu is open for a track that lacks a resolvable video path or lacks a resolvable sibling subtitle, or VideoCaptioner is unavailable
- **THEN** **Synthesize** is disabled
- **AND** activating it does not open **`SynthesizeSubtitleDialog`**
