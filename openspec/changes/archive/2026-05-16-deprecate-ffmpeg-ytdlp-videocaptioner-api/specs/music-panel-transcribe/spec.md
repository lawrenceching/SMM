## MODIFIED Requirements

### Requirement: Music panel TranscribeDialog rows map from music files

The system SHALL populate **`TranscribeDialog`** rows from **`MusicPanel`** music file data such that each transcribe execution receives a resolvable file path for the selected transcription provider, using stable row identifiers consistent with TV and movie **`TranscribeDialog`** rows.

#### Scenario: Row path resolves for API

- **WHEN** the user confirms **`TranscribeDialog`** opened from **`MusicPanel`** with one or more rows selected
- **THEN** each selected row maps to a **`path`** that the transcribe pipeline can convert to a platform path for **executeCmd VideoCaptioner transcribe** when **VideoCaptioner** is selected **or** for the Tencent ASR transcribe API when **Tencent ASR** is selected
