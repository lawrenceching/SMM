## MODIFIED Requirements

### Requirement: Transcribe dialog rows map from mediaFiles

The system SHALL populate **`TranscribeDialog`** rows from **`MediaMetadata.mediaFiles`** such that each transcribe execution receives a resolvable file path for the selected transcription provider.

#### Scenario: Row path resolves for API

- **WHEN** the user confirms **`TranscribeDialog`** with one or more rows selected
- **THEN** each selected row maps to a **`path`** that the transcribe pipeline can convert to a platform path for **executeCmd VideoCaptioner transcribe** when **VideoCaptioner** is selected **or** for the Tencent ASR transcribe API when **Tencent ASR** is selected
