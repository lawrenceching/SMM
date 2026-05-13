## Purpose

Define **`MusicFileTable`** row indicators and **Subtitle** submenu behavior for full-pipeline **Process** jobs on music tracks.

## Requirements

### Requirement: MusicFileTable exposes process row status

The system SHALL extend **`MusicFileRow`** with **`processStatus?: 'running' | 'failed'`** and extend **`MusicFileTableProps`** with optional handlers **`onTrackProcess?(row)`**, **`onProcessStop?(row)`**, and **`isProcessAvailable?`**, mirroring **`synthesizeStatus`** / **`onTrackSynthesize`** patterns.

#### Scenario: Title cell shows process progress or failure

- **WHEN** a row has an in-flight **`process`** job (`running`) or a terminal failure visible to the row mapping
- **THEN** the title cell shows a distinct indicator (spinner for `running`, error styling for `failed`) with localized tooltips
- **AND** indicators can coexist with transcribe, translate, and synthesize indicators when multiple job types apply

### Requirement: MusicFileTable row Subtitle submenu includes Stop process

The system SHALL show **Stop process** inside the row **Subtitle** submenu when **`processStatus === 'running'`** for that row, and activating it SHALL stop the running job for that row via the same stop plumbing used for **Stop synthesize**.

#### Scenario: Stop process only when running

- **WHEN** `processStatus` is not `running`
- **THEN** **Stop process** is not shown in the submenu

### Requirement: Submenu gating for Process on music rows

The system SHALL disable the **Process** item in the row **Subtitle** submenu when VideoCaptioner is unavailable, when the track has no resolvable media path suitable for the pipeline, when ASR or translator configuration does not support the chosen defaults, or when the pipeline is otherwise ineligible per **`process-pipeline-dialog`** rules.

#### Scenario: Process disabled for ineligible track

- **WHEN** the row **Subtitle** submenu is open for a track that lacks a resolvable path, or VideoCaptioner is unavailable, or ASR gating fails
- **THEN** **Process** is disabled
- **AND** activating it does not open **`ProcessPipelineDialog`**
