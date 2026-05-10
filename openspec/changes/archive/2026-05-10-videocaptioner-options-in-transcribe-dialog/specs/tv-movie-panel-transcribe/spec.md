## MODIFIED Requirements

### Requirement: TV show panel header exposes Transcribe

The system SHALL provide a **Transcribe** control in the TV show panel header when the panel has loaded media metadata for the selected folder.

#### Scenario: Transcribe opens dialog with media files

- **WHEN** a user clicks **Transcribe** in the TV show panel header and **`MediaMetadata.mediaFiles`** contains at least one entry
- **THEN** the UI opens **`TranscribeDialog`**
- **AND** the dialog lists one row per **`mediaFiles`** video entry derived from **`absolutePath`** (and optional display title)

#### Scenario: Transcribe disabled when no transcription path is available

- **WHEN** VideoCaptioner discovery indicates unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the TV show panel **Transcribe** control is not actionable for transcription (disabled or equivalent)

#### Scenario: Transcribe enabled with Tencent when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery indicates unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the TV show panel **Transcribe** control remains actionable for transcription when **`mediaFiles`** contains at least one eligible entry

### Requirement: Movie panel header exposes Transcribe

The system SHALL provide a **Transcribe** control in the movie panel header when the panel has loaded media metadata for the selected folder.

#### Scenario: Transcribe opens dialog with movie video file

- **WHEN** a user clicks **Transcribe** in the movie panel header and **`MediaMetadata.mediaFiles`** contains the movie video file
- **THEN** the UI opens **`TranscribeDialog`** with at least one row for that file

#### Scenario: Transcribe disabled when no transcription path is available

- **WHEN** VideoCaptioner discovery indicates unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the movie panel **Transcribe** control is not actionable for transcription (disabled or equivalent)

#### Scenario: Transcribe enabled with Tencent when VideoCaptioner is unavailable

- **WHEN** VideoCaptioner discovery indicates unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the movie panel **Transcribe** control remains actionable for transcription when the movie video file is present in **`mediaFiles`**

### Requirement: Transcribe dialog rows map from mediaFiles

The system SHALL populate **`TranscribeDialog`** rows from **`MediaMetadata.mediaFiles`** such that each transcribe execution receives a resolvable file path for the selected transcription provider.

#### Scenario: Row path resolves for API

- **WHEN** the user confirms **`TranscribeDialog`** with one or more rows selected
- **THEN** each selected row maps to a **`path`** that the transcribe pipeline can convert to a platform path for **`/api/videocaptioner/transcribe`** when **VideoCaptioner** is selected **or** for the Tencent ASR transcribe API when **Tencent ASR** is selected
