## MODIFIED Requirements

### Requirement: Music panel header opens TranscribeDialog

The system SHALL provide a **Transcribe** control in **`MusicHeaderV2`** when **`MusicPanel`** has loaded tracks for the selected folder, and SHALL open **`TranscribeDialog`** from that control instead of starting transcription immediately.

#### Scenario: Transcribe opens dialog listing eligible tracks

- **WHEN** a user clicks **Transcribe** in **`MusicHeaderV2`** and at least one displayed music track has a resolvable local file **`path`**
- **THEN** the UI opens **`TranscribeDialog`**
- **AND** the dialog lists one row per such track with a **`path`** suitable for transcription (VideoCaptioner or Tencent ASR per user choice in the dialog)

#### Scenario: Default selection uses current multi-select when non-empty

- **WHEN** a user clicks **Transcribe** in **`MusicHeaderV2`** while **`MusicFileTable`** has one or more selected tracks that each have a resolvable **`path`**
- **THEN** **`TranscribeDialog`** opens with exactly those tracks checked among the listed rows
- **AND** unchecked tracks remain listed but not selected

#### Scenario: Default selection is all eligible tracks when selection is empty

- **WHEN** a user clicks **Transcribe** in **`MusicHeaderV2`** while no tracks are selected in **`MusicFileTable`** multi-select state (or none of the selected tracks have a **`path`**)
- **THEN** **`TranscribeDialog`** opens with every listed row selected by default

#### Scenario: Transcribe disabled when no transcription path is available

- **WHEN** VideoCaptioner discovery indicates unavailable for transcription **and** Tencent ASR transcription is not enabled for the application
- **THEN** the music panel header **Transcribe** control is not actionable for transcription (disabled or equivalent)

#### Scenario: Header transcribe enabled with Tencent when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery indicates unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the music panel header **Transcribe** control remains actionable for transcription when eligible tracks exist

#### Scenario: No eligible tracks prevents opening dialog

- **WHEN** a user clicks **Transcribe** in **`MusicHeaderV2`** and no displayed track has a resolvable **`path`**
- **THEN** the UI does not open **`TranscribeDialog`**
- **AND** the user receives clear feedback that there is nothing to transcribe

### Requirement: Music panel track context menu opens TranscribeDialog with targeted selection

The system SHALL open **`TranscribeDialog`** from the **`MusicFileTable`** context menu **Transcribe** action and SHALL reset table multi-select so only the context-menu target track is selected inside the dialog.

#### Scenario: Context menu opens dialog with single track checked

- **WHEN** a user invokes **Transcribe** from the context menu on a track that has a resolvable **`path`** while **either** VideoCaptioner is available **or** Tencent ASR transcription is enabled for the application
- **THEN** the UI clears **`MusicFileTable`** multi-select state (no rows remain selected in the table)
- **AND** **`TranscribeDialog`** opens listing eligible tracks for the folder
- **AND** only the context-menu target track is selected among dialog rows

#### Scenario: Context menu transcribe disabled when no transcription path is available

- **WHEN** a user opens **`MusicFileTable`** context menu while VideoCaptioner discovery state is unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the **Transcribe** menu item is not actionable for transcription (disabled or equivalent)

### Requirement: Music panel TranscribeDialog rows map from music files

The system SHALL populate **`TranscribeDialog`** rows from **`MusicPanel`** music file data such that each transcribe execution receives a resolvable file path for the selected transcription provider, using stable row identifiers consistent with TV and movie **`TranscribeDialog`** rows.

#### Scenario: Row path resolves for API

- **WHEN** the user confirms **`TranscribeDialog`** opened from **`MusicPanel`** with one or more rows selected
- **THEN** each selected row maps to a **`path`** that the transcribe pipeline can convert to a platform path for **`/api/videocaptioner/transcribe`** when **VideoCaptioner** is selected **or** for the Tencent ASR transcribe API when **Tencent ASR** is selected
