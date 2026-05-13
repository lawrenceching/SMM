## Purpose

Define the **Subtitle** parent control and menus in **TvShow**, **Movie**, and **Music** panel headers and in **`MusicFileTable`** row context menus, including **Transcribe**, **Translate**, **Synthesize**, and **Process** items and gating.

## Requirements

### Requirement: TV show panel header exposes a Subtitle parent

The system SHALL replace the TV show panel header's flat **Transcribe** control with a **Subtitle** control that, when activated, opens a menu containing **Transcribe**, **Translate**, **Synthesize**, and **Process** (full VideoCaptioner pipeline).

#### Scenario: Subtitle button opens menu

- **WHEN** a user clicks **Subtitle** in `TvShowHeaderV2`
- **THEN** a menu opens with menu items **Transcribe**, **Translate**, **Synthesize**, and **Process**
- **AND** activating **Transcribe** opens `TranscribeDialog` with the same behavior as the prior flat **Transcribe** control
- **AND** activating **Translate** opens `SubtitleTranslationDialog`
- **AND** activating **Synthesize** opens `SynthesizeSubtitleDialog`
- **AND** activating **Process** opens `ProcessPipelineDialog`

#### Scenario: Subtitle disabled when no child is actionable

- **WHEN** there are no eligible media files for transcribe AND no eligible source subtitle files for translate AND no eligible **(video, subtitle)** pairs for synthesize AND no eligible media files for **Process**, OR when neither VideoCaptioner nor Tencent ASR is available for transcribe AND VideoCaptioner is unavailable for translate AND VideoCaptioner is unavailable for synthesize AND VideoCaptioner is unavailable for **Process**
- **THEN** the **Subtitle** control is disabled

#### Scenario: Per-child gating inside menu

- **WHEN** the menu is open
- **THEN** **Transcribe** is disabled when neither VideoCaptioner nor Tencent ASR is available **or** when there are no eligible media files
- **AND** **Translate** is disabled when VideoCaptioner is unavailable **or** when there are no eligible source subtitle files
- **AND** **Synthesize** is disabled when VideoCaptioner is unavailable **or** when there are no eligible **(video, subtitle)** pairs for synthesis
- **AND** **Process** is disabled when VideoCaptioner is unavailable **or** when there are no eligible media files for the pipeline **or** when ASR or translator configuration does not satisfy gating for the default pipeline options

### Requirement: Movie panel header exposes a Subtitle parent

The system SHALL replace the movie panel header's flat **Transcribe** control with a **Subtitle** control that opens a menu containing **Transcribe**, **Translate**, **Synthesize**, and **Process**, applying the same opening behavior and per-child gating as the TV show panel.

#### Scenario: Subtitle button opens menu

- **WHEN** a user clicks **Subtitle** in `MovieHeaderV2`
- **THEN** a menu opens with **Transcribe**, **Translate**, **Synthesize**, and **Process** items
- **AND** activating **Transcribe** opens `TranscribeDialog`
- **AND** activating **Translate** opens `SubtitleTranslationDialog`
- **AND** activating **Synthesize** opens `SynthesizeSubtitleDialog`
- **AND** activating **Process** opens `ProcessPipelineDialog`

#### Scenario: Per-child gating mirrors TV show

- **WHEN** the menu is open in `MovieHeaderV2`
- **THEN** **Transcribe** is disabled when neither VideoCaptioner nor Tencent ASR is available or when no eligible media file is present
- **AND** **Translate** is disabled when VideoCaptioner is unavailable or when the movie video file has no resolvable source subtitle
- **AND** **Synthesize** is disabled when VideoCaptioner is unavailable or when there is no eligible **(video, subtitle)** pair for the movie
- **AND** **Process** is disabled when VideoCaptioner is unavailable or when there is no eligible media file for the pipeline or ASR or translator gating fails

### Requirement: Music panel header exposes a Subtitle parent

The system SHALL replace `MusicHeaderV2`'s flat **Transcribe** button with a **Subtitle** button that opens a menu containing **Transcribe**, **Translate**, **Synthesize**, and **Process**.

#### Scenario: Subtitle menu honors multi-select default behavior

- **WHEN** a user activates **Transcribe** from the **Subtitle** menu in `MusicHeaderV2` while `MusicFileTable` has one or more selected tracks
- **THEN** `TranscribeDialog` opens with exactly those tracks pre-selected, consistent with the prior flat-button behavior
- **AND** when no tracks are selected, `TranscribeDialog` opens with every eligible track pre-selected

#### Scenario: Translate menu default selection from multi-select

- **WHEN** a user activates **Translate** from the **Subtitle** menu in `MusicHeaderV2` while `MusicFileTable` has one or more selected tracks
- **THEN** `SubtitleTranslationDialog` opens with the subtitle rows whose media path matches a selected track pre-selected
- **AND** when no tracks are selected, `SubtitleTranslationDialog` opens with every eligible subtitle row pre-selected

#### Scenario: Synthesize menu default selection from multi-select

- **WHEN** a user activates **Synthesize** from the **Subtitle** menu in `MusicHeaderV2` while `MusicFileTable` has one or more selected tracks
- **THEN** `SynthesizeSubtitleDialog` opens with the synthesize rows whose media path matches a selected track pre-selected when those rows are eligible
- **AND** when no tracks are selected, `SynthesizeSubtitleDialog` opens with every eligible synthesize row pre-selected

#### Scenario: Process menu default selection from multi-select

- **WHEN** a user activates **Process** from the **Subtitle** menu in `MusicHeaderV2` while `MusicFileTable` has one or more selected tracks
- **THEN** `ProcessPipelineDialog` opens with the pipeline rows whose media path matches a selected track pre-selected when those rows are eligible
- **AND** when no tracks are selected, `ProcessPipelineDialog` opens with every eligible pipeline row pre-selected

#### Scenario: No eligible targets prevents opening

- **WHEN** a user activates **Transcribe** with no eligible tracks present, or activates **Translate** with no eligible subtitle rows present, or activates **Synthesize** with no eligible **(video, subtitle)** rows present, or activates **Process** with no eligible pipeline rows present
- **THEN** the corresponding dialog does not open
- **AND** a clear toast informs the user that there is nothing to transcribe, translate, synthesize, or run as a full pipeline for that action

### Requirement: MusicFileTable row context menu uses Subtitle submenu

The system SHALL replace the flat **Transcribe** item in the `MusicFileTable` row context menu with a **Subtitle** submenu (`ContextMenuSub`/`ContextMenuSubTrigger`/`ContextMenuSubContent`) containing **Transcribe**, **Translate**, **Synthesize**, **Process**, and matching **Stop transcribe** / **Stop translate** / **Stop synthesize** / **Stop process** items that appear only when a job of the corresponding type is `running` for the row.

#### Scenario: Submenu contents

- **WHEN** the user opens a row's context menu
- **THEN** the row exposes a **Subtitle** submenu
- **AND** the submenu contains **Transcribe**, **Translate**, **Synthesize**, and **Process** items
- **AND** when a `transcribe` job is `running` for this row, a **Stop transcribe** item is also shown
- **AND** when a `translate` job is `running` for this row, a **Stop translate** item is also shown
- **AND** when a `synthesize` job is `running` for this row, a **Stop synthesize** item is also shown
- **AND** when a `process` job is `running` for this row, a **Stop process** item is also shown

#### Scenario: Submenu items reset multi-select on activation

- **WHEN** a user activates **Transcribe** from the row submenu on a track with a resolvable file path
- **THEN** multi-select state is cleared and `TranscribeDialog` opens with only the target track selected, consistent with prior context-menu transcribe behavior
- **AND** when a user activates **Translate** from the row submenu on a track with at least one eligible source subtitle, multi-select state is cleared and `SubtitleTranslationDialog` opens with only that track's subtitle rows pre-selected
- **AND** when a user activates **Synthesize** from the row submenu on a track with at least one eligible **(video, subtitle)** pair, multi-select state is cleared and `SynthesizeSubtitleDialog` opens with only that track's eligible rows pre-selected
- **AND** when a user activates **Process** from the row submenu on a track with at least one eligible pipeline media path, multi-select state is cleared and `ProcessPipelineDialog` opens with only that track's eligible rows pre-selected

#### Scenario: Submenu items gated by availability

- **WHEN** the row submenu is open
- **THEN** **Transcribe** is disabled when neither VideoCaptioner nor Tencent ASR is available, or the track has no resolvable file path, or the track has no in-progress transcribe job and no transcribe target
- **AND** **Translate** is disabled when VideoCaptioner is unavailable, or the track has no resolvable source subtitle file
- **AND** **Synthesize** is disabled when VideoCaptioner is unavailable, or the track has no eligible **(video, subtitle)** pair for synthesis
- **AND** **Process** is disabled when VideoCaptioner is unavailable, or the track has no eligible pipeline target, or ASR or translator gating fails

#### Scenario: Subtitle parent reflects child availability

- **WHEN** **Transcribe**, **Translate**, **Synthesize**, and **Process** would all be disabled for this row
- **THEN** the **Subtitle** submenu trigger is itself disabled
